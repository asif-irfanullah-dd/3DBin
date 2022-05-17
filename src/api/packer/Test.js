this.params = params;
this.packingSpace = new PackingSpace();
this.cargoList = new CargoList();
this.solverExecutionsCount = 0;
{
this.solverExecutionsCount++;
let algorithm = params.algorithm; 
let algorithmParams = params.algorithmParams;
this.SolveCUB(algorithmParams);

}

//SolveCub Block
{
const Container = CUB.Container;
const Item = CUB.Item;
var containingVolume = this.packingSpace.current.volume;
var d = containingVolume.dimensions;
var container = new Container(containingVolume.uid, d.width, d.height, d.length, containingVolume.weightCapacity);
        
var numTotalItems = 0;

         
var items = [];
var entries = {};
    for(let group of this.cargoList.groups.values()){
        
            let entry = group.entry;
            entries[entry.uid] = entry;
            d = entry.dimensions;
            let validOrientations = entry.properties.rotation.enabled ? entry.properties.rotation.allowedOrientations : undefined;
            let stackingCapacity = entry.properties.stacking.enabled ? entry.properties.stacking.capacity : (entry.weight > epsilon ? entry.weight * this.params.defaultStackingFactor : Number.MAX_SAFE_INTEGER - 10);
            console.log(stackingCapacity)
            let grounded = entry.properties.translation.enabled ? entry.properties.translation.grounded : false;
            let item = new Item(entry.uid, d.width, d.height, d.length, entry.weight, entry.quantity, validOrientations, stackingCapacity, grounded);
            items.push(item);
            numTotalItems += entry.quantity;
        }

var startTime = performance.now();
}

//Heuristic Parameter Extraction and Function Call
{
let heuristicParams = extractHeuristicParams(params);
let heuristic = new CUB.heuristics.HeuParametric1(heuristicParams);
var result = await CUB.pack(container, items, heuristic);
}

{
    //HeuParametric1 class
    // constructor(params) 
    {
        this.params = params;
        this.workingSet = new workingSetType(this.params);
    }
    // SetItems(items){ this[_items] = items.slice(); }   
    this.items.sort(Item.VolumeSort);
    this.minDimensions = Item.GetMinDimensions(this.items);
    this.minDimensionsNoWasteFactor = [1, 1, 1];
    this.regionScoreTable = [];
    //SetPackedContainer(packedContainer){ this[_packedContainer] = packedContainer; }
    //SetRegionsTree(regionsTree){ this[_regionsTree] = regionsTree; }
}

{
    async function pack(container, items, heuristic){
        let cub = new CUB(container);
        heuristic.workingSet.SetItems(items); 
        heuristic.workingSet.SetPackedContainer(cub.packedContainer);
        heuristic.workingSet.SetRegionsTree(cub.regionsTree);
    
        let fallback = new HeuRegular();
            fallback.workingSet.SetItems(items);
            fallback.workingSet.SetPackedContainer(cub.packedContainer);
            fallback.workingSet.SetRegionsTree(cub.regionsTree);
    
        let result = await cub.Solve(heuristic, fallback);
        console.log('Results in CUB call stack')
        console.log(result)  
}

{
    //async Solve(heuristic, fallback)
    {
        let scope = this;
        let packedContainer = this.packedContainer;

        let log = { successful: 0, failed: 0, heuristic: 0, fallback: 0 };

        // Helper function
        /** @param {Item} item @param {Heuristic} workingHeuristic @param {Boolean} final */
        function unpackItem(item, workingHeuristic, final){
            if(final) packedContainer.Unpack(item);
            workingHeuristic.Unpack(item);

            if(final) log.failed++;
        }

        // Helper function
        /** @param {PackedItem} packedItem @param {Heuristic} workingHeuristic */
        function packItem(packedItem, workingHeuristic){
            packedContainer.Pack(packedItem);
            packedItem.ref.quantity--;

            if(workingHeuristic === heuristic) log.heuristic++;
            else log.fallback++;

            log.successful++;
        }

        let nextItem;

        /** @param {Heuristic} workingHeuristic @param {Boolean} final */
        async function fitWith(workingHeuristic, final){
            while( nextItem = await workingHeuristic.NextItem() ){

                scope.ProcessRegions();
                packedContainer.packedItems.sort(PackedItem.Sort);
    
                // Try to pack item
                let packedItem = scope.FitUsingHeuristic(nextItem, workingHeuristic);
    
                if( packedItem === false ){
                    unpackItem(nextItem, workingHeuristic, final);
                }
                else{
                    packItem(packedItem, workingHeuristic);
                }
    
                /**/await sleep(30);
            }
        }

        await fitWith(heuristic, false);
        if(fallback){
            await fitWith(fallback, true);
        }

        console.log('Solved it:', log);

        return packedContainer;
    }
}

    //ProcessRegions()
{

    let containerWidth = this.container.width,
        containerHeight = this.container.height;

    // Recalculate preferred insertion side per region (left or right)
    this.regionsTree.ProcessRegionsPreferredX(containerWidth);

    // Merge and expand free regions (can span several packed item tops)
    this.regionsTree.ProcessRegionsMergeExpand(containerWidth, containerHeight);

    // Removes regions that are completely enclosed in packed volumes, and correct any intersecting ones
    this.ProcessRegionsForPackedItems(false);

    // Removes unuseable regions
    this.regionsTree.ProcessRegionsForZeroRegions();

    // Removes regions that are completely enclosed in larger regions
    this.regionsTree.ProcessRegionsEnclosed();

    // Recalculate preferred insertion side per region (left or right)
    this.regionsTree.ProcessRegionsPreferredX(containerWidth);

    // Sort by z (first) and volume (second)
    this.regionsTree.Sort(Region.SortDeepestSmallest);
}
    // RateFit(fit, newRegions)
    {
        
        // Try out a recursive deep rate fit
        let containerLength = this.packedContainer.container.length;
        let minDimensions = this.minDimensions;
        let minDimensionsNoWasteFactor = this.minDimensionsNoWasteFactor;
        let minZScore = 1 - (fit.z + fit.length) / containerLength; // 0-1

        // new regions usability score
        let minWasteScore = 1; // have completely filled the region if newRegions.length === 0
        if(newRegions.length > 0){
            minWasteScore = 0;
            for(let iRegion = 0; iRegion < newRegions.length; iRegion++){
                let region = newRegions[iRegion];
                
                let scoreW = 0, scoreH = 0, scoreL = 0;
                if(region.width >= minDimensions[0] && (region.width - minDimensions[0]) < minDimensions[0] * minDimensionsNoWasteFactor[0]) scoreW += 1;
                if(region.height >= minDimensions[1] && (region.width - minDimensions[1]) < minDimensions[1] * minDimensionsNoWasteFactor[1]) scoreH += 1;
                if(region.length >= minDimensions[2] && (region.width - minDimensions[2]) < minDimensions[2] * minDimensionsNoWasteFactor[2]) scoreL += 1;
                
                minWasteScore += scoreW * .5 + scoreH * .3 + scoreL * .2;
            }
            minWasteScore /= newRegions.length;
        }

        let minYWeight = this.params.scoring.minZ;
        let minWasteWeight = this.params.scoring.minWaste;
        let score = minZScore * minYWeight + minWasteScore * minWasteWeight;
        return score;
    }

    /** @param {Region} region */
    //FitFunction(region)
    
    {
        let regionScoreTable = this.regionScoreTable;

        let item = this.workingItem;
        let validOrientations = item.validOrientations;       

        if(region.volume > item.volume){
            let dummyRegion = tempRegion.Copy(region);

            orientationScoreTable.length = 0;
            for(let iOrient = 0; iOrient < validOrientations.length; iOrient++){
                let orientation = validOrientations[iOrient];

                let dimensions = item.GetOrientedDimensions(orientation);
                let regionFitTest = region.FitTest(smallValue, 
                    dimensions[0], dimensions[1], dimensions[2], 
                    item.weight, item.grounded);
                
                if(regionFitTest !== false){

                    // Subtracts fit from region and calculates new bounding regions
                    let newRegions = dummyRegion.Subtract(regionFitTest, minRegionAxis);
                    if(newRegions === undefined) newRegions = [];
                    if(dummyRegion.length > minRegionAxis)
                        newRegions.push(dummyRegion);

                    let score = this.RateFit(regionFitTest, newRegions)
                    let orientationScore = scoreConstructor(region, orientation, score);
                    orientationScoreTable.push(orientationScore);
                }
            }

            if(orientationScoreTable.length > 0){
                orientationScoreTable.sort(sortByN);
                let regionScore = orientationScoreTable.pop();
                regionScoreTable.push(regionScore);
            }
        }

        return false;
    }    
    //Fit()
    {
        
        this.regionsTree.Find(this.FitFunction, this);

        if(this.regionScoreTable.length > 0){

            this.regionScoreTable.sort(sortByN);
            let highestScore = this.regionScoreTable.pop();

            let containingRegion = highestScore.region,
                orientation = highestScore.orientation;
            let dimensions = this.workingItem.GetOrientedDimensions(orientation);
            
            // Fit test (success: Region, failure: false)
            let regionFitTest = containingRegion.FitTest(smallValue, 
                dimensions[0], dimensions[1], dimensions[2],
                this.workingItem.weight, this.workingItem.grounded);
            
            if(regionFitTest !== false){
        
                let result = new Heuristic.Result(containingRegion, regionFitTest, orientation);
                return result;
            }
        }

        return false;
    }
}

{

}

    
    


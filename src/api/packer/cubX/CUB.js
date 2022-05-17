/** @author chadiik <http://chadiik.com/> */

import { epsilon, smallValue, smallValueSqrt } from "./core/Math2D";
import Region from "./core/Region";
import OccupiedRegion from "./core/OccupiedRegion";
import RegionsTree from "./core/RegionsTree";
import StackedRegion from "./core/StackedRegion";
import { Container, Item } from "./core/Components";
import { PackedItem, PackedContainer } from "./core/PackedComponents";
import Heuristic from "./heuristics/Heuristic";
import { debugLog, sleep } from './CUBDebug';
import HeuRegular from "./heuristics/HeuRegular";
import HeuParametric1 from "./heuristics/HeuParametric1";

const heuristics = {
    HeuRegular: HeuRegular,
    HeuParametric1: HeuParametric1
};

var tempRegion = new Region();


class CUB{
    /**
     * @param {Container} container 
     */
    constructor(container){
        
        this.container = container;
        this.packedContainer = new PackedContainer(container);

        let firstRegion = new Region(0, 0, 0, container.width, container.height, container.length, 0);
            firstRegion.SetWeights(0, container.weightCapacity, 0);
        this.regionsTree = new RegionsTree(firstRegion);
        let firstOccupiedRegion = new OccupiedRegion(0, 0, 0, container.width, 0, container.length, container, 0 , 0);
        firstOccupiedRegion.SetWeights(0, container.weightCapacity, 0);
        this.occupiedRegionsTree = new RegionsTree(firstOccupiedRegion);       
        
    }        

    /** @param {PackedItem} packedItem @param {Boolean} [harsh] default = false */
    ProcessRegionsPerPackedItem(packedItem, harsh){
        let regions = this.regionsTree.regions;
        let itemVolume = packedItem.ref.volume;
        
        // Creates temporary region for following calculations
        let packedRegion = tempRegion.Set(packedItem.x, packedItem.y, packedItem.z, packedItem.packedWidth, packedItem.packedHeight, packedItem.packedLength, 0);
        packedRegion.SetWeights(packedItem.ref.weight, 0, packedItem.ref.stackingCapacity);

        for(let iRegion = 0; iRegion < regions.length; iRegion++){
            let region = regions[iRegion];

            if(itemVolume > region.volume && packedRegion.ContainsRegion(smallValue, region)){
                regions.splice(iRegion, 1);
                iRegion--;
                console.log('Contained region' + iRegion + ' deleted');
                continue;
            }

            if(packedRegion.Intersects(-smallValue, region)){

                if(harsh){
                    console.log('\tIntersecting region' + iRegion + ' deleted (!)');
                    regions.slice(iRegion, 1);
                    iRegion--;
                    continue;
                }
                
                let regionRemains = this.regionsTree.Occupy(region, packedRegion);
                iRegion --;
            }
        }
    }

    ProcessRegionsForPackedItems(harsh){
        let packedItems = this.packedContainer.packedItems;
        let numPackedItems = packedItems.length;

        for(let iItem = 0; iItem < numPackedItems; iItem++){
            let packedItem = packedItems[iItem];
            this.ProcessRegionsPerPackedItem(packedItem, harsh);
        }
    }
    
      

    ProcessRegions(){

        let containerWidth = this.container.width,
            containerHeight = this.container.height;

        // Recalculate preferred insertion side per region (left or right)
        // this.regionsTree.ProcessRegionsPreferredX(containerWidth);

        // Merge and expand free regions (can span several packed item tops)
        this.regionsTree.ProcessRegionsMergeExpand(containerWidth, containerHeight);        
        
        // Removes regions that are completely enclosed in packed volumes, and correct any intersecting ones
        this.ProcessRegionsForPackedItems(false);

        // Removes unuseable regions
        this.regionsTree.ProcessRegionsForZeroRegions();

        // Removes regions that are completely enclosed in larger regions
        this.regionsTree.ProcessRegionsEnclosed();

        // Recalculate preferred insertion side per region (left or right)
        //this.regionsTree.ProcessRegionsPreferredX(containerWidth);

        // Sort by z (first) and volume (second)
        this.regionsTree.Sort(Region.SortDeepestSmallest);
    }

    /** @param {Item} item @param {Heuristic} heuristic */
    FitUsingHeuristic(item, heuristic){
            
        let result = heuristic.Fit(item);
        if(result){
            let placement = result.packedRegion;
            placement.SetWeights(item.weight, 0, item.stackingCapacity);

            // Create a new packed item
            let packedItem = new PackedItem(item, placement.x, placement.y, placement.z, placement.width, placement.height, placement.length, result.orientation);
                        
            let packedRegion = new OccupiedRegion(packedItem.x, packedItem.y, packedItem.z, packedItem.packedWidth, packedItem.packedHeight, packedItem.packedLength, packedItem.ref, 0);
            packedRegion.SetWeights(packedItem.ref.weight, 0, packedItem.ref.stackingCapacity);
            // Reserve the tested sub region: regionFitTest from the containing region: region
            let regionRemains = this.regionsTree.Occupy(result.containingRegion, placement, packedItem);
            let OccupiedRemains = this.occupiedRegionsTree.AddRegion(packedRegion)
            // console.log(this.occupiedRegionsTree.regions, 'Occupied Regions')                    
            return packedItem;
        }

        return false;
    }

    /** @param {Heuristic} heuristic @param {Heuristic} fallback */
    async Solve(heuristic){
        
        let scope = this;
        let packedContainer = this.packedContainer;

        let log = { successful: 0, failed: 0, heuristic: 0 };

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
            

            log.successful++;
        }

        let nextItem;

        /** @param {Heuristic} workingHeuristic @param {Boolean} final */
        async function fitWith(workingHeuristic, final){
            while( nextItem = await workingHeuristic.NextItem() ){

                scope.ProcessRegions();
                //packedContainer.packedItems.sort(PackedItem.Sort);
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
        
        await fitWith(heuristic, true);
        packedContainer.packedItems.sort(PackedItem.Sort);
        //console.log('Solved it:', log);

        return packedContainer;
    }
}
async function pack(container, items, heuristic){   
                                                    
    let cub = new CUB(container);
                       
    heuristic.workingSet.SetItems(items);           
    heuristic.workingSet.SetPackedContainer(cub.packedContainer);
    heuristic.workingSet.SetRegionsTree(cub.regionsTree);
    heuristic.workingSet.SetOccupiedRegionsTree(cub.occupiedRegionsTree);
    
    let result = await cub.Solve(heuristic);    
    return result;
}

export {
    Item,
    Container,
    pack,
    heuristics
};
import CargoList from "./CargoList";
import PackingSpace from "./PackingSpace";
import BoxEntry from "../components/box/BoxEntry";
import Utils from "../utils/cik/Utils";
import Signaler from "../utils/cik/Signaler";
import ContainingVolume from "./container/ContainingVolume";

const CUB = require('./cubX/CUB');

/** @typedef CUBParams
 * @property {Number} score_minLength [0, 1] influence position of cargo in length
 * 
 * (higher values means the algorithm will try to pack as tightly as possible in length)
 * 
 * @property {Number} score_minWastedSpace [0, 1] influence orientation of cargo 
 * 
 * (higher values means the algorithm will try to minimize orientation that results in 'unuseable' unpacked volumes)
 */

const typeofHeuristicParams = CUB.heuristics.HeuParametric1.Params;

function ItemConstructor(category, quantity){ return { category: category, quantity: quantity}; }

/** @param {CUBParams} cubParams @param {typeofHeuristicParams} heuristicParams */
function extractHeuristicParams(cubParams, heuristicParams){
    if(heuristicParams === undefined) heuristicParams = new typeofHeuristicParams();

    let scoringWeight = cubParams.score_minLength + cubParams.score_minWastedSpace;

    heuristicParams.scoring.minZ = cubParams.score_minLength / scoringWeight;
    heuristicParams.scoring.minWaste = cubParams.score_minWastedSpace / scoringWeight;
    return heuristicParams;
}

/**
 * @typedef {Object} PackerParams
 * @property {import('../UX').default} ux
 * @property {Number} defaultStackingFactor
 */ 

/** @typedef SolverParams
 * @property {CUBParams} algorithmParams
 * @property {string} algorithm default = 'cub'
 */

class PackedCargo {
    /**
     * @param {BoxEntry} entry 
     * @param {ContainingVolume} containingVolume 
     * @param {THREE.Vector3} position 
     * @param {Number} orientation 
     */
    constructor(entry, containingVolume, position, orientation){
        this.entry = entry;
        this.containingVolume = containingVolume;
        this.position = position;
        this.orientation = orientation;
    }
}

class UnpackedCargo {
    /**
     * @param {BoxEntry} entry 
     * @param {Number} unpackedQuantity
     */
    constructor(entry, unpackedQuantity){
        this.entry = entry;
        this.unpackedQuantity = unpackedQuantity;
    }
}

class PackingResult{
    /** @param {Number} numTotalItem @param {Number} runtime */
    constructor(numTotalItems, runtime){
        /** @type {Array<PackedCargo>} */
        this.packed = [];

        /** @type {Array<UnpackedCargo>} */
        this.unpacked = [];

        this.numTotalItems = numTotalItems || 0;

        this.runtime = runtime || -1;
    }
}

/** @type {PackerParams} */
const defaultParams = {};
const signals = {
    packUpdate: 'packUpdate',
    packFailed: 'packFailed'
};

const _solverParams = Symbol('solverParams');

const epsilon = Math.pow(2, -52);

class Packer extends Signaler {
    /** @param {PackerParams} params */
    constructor(params){
        super();

        /** Shared object with PackerInterface's params  */
        this.params = params;

        this.packingSpace = new PackingSpace();
        this.cargoList = new CargoList();

        this.solverExecutionsCount = 0;
    }     

    GetItemDetails(items){

        let Items = []
        for(let i=0;i<items.length;i++){ 
            
            Items.push(ItemConstructor(items[i].category ,items[i].quantity))
            
        }
        return Items;

    }

    GetItemIds(items){
        let ItemIDS = []
        for(let i=items.length-1;i>=0;i--) {             
            ItemIDS.push(items[i].id)            
        }
        return ItemIDS

    }

    CheckPairedItemsSKU2(items){
        let k = items.length/2;
        for(let i = items.length-1; i>=k; i -- )
        {
            if(items[i].quantity!=items[i-k].quantity) return false;
        }
        return true;
    }

    CheckPairedItemsSKU3(items){
        let k = items.length / 3;
        for (let i = 0; i < k; i++) {
            if (items[i].quantity != items[i + k].quantity || items[i].quantity != items[i + 2 * k].quantity || items[i + k].quantity != items[i + 2 * k].quantity) return false;
        }
        return true;

    }
    IncreementItemQuantity(items, inititalItems){
        let SKUs = this.GetSKUS(items);
        let InitialSKU = this.GetSKUS(inititalItems);
        for(let i = 0; i<SKUs[2].length/3; i++ ){
            let k = SKUs[2].length/3;
            if(SKUs[2][i].quantity < InitialSKU[2][i].quantity)
            {
                SKUs[2][i].quantity += 1;
                SKUs[2][i + k].quantity += 1;
                SKUs[2][i + 2 * k].quantity += 1;
                
                let SKU = this.JoinSKU(SKUs[0],SKUs[1],SKUs[2]);
                return SKU;
            }
        }
        for(let i = 0; i<SKUs[1].length/2; i++ ){
            let k = SKUs[1].length/2;
            if(SKUs[1][i].quantity < InitialSKU[1][i].quantity)
            {
                SKUs[1][i].quantity += 1;
                SKUs[1][i + k].quantity += 1;
                
                
                let SKU = this.JoinSKU(SKUs[0],SKUs[1],SKUs[2]);
                return SKU;
            }
        } 
        for(let i = 0; i<SKUs[0].length; i++ ){
            if(SKUs[0][i].quantity < InitialSKU[0][i].quantity)
            {
                SKUs[0][i].quantity += 1;
                let SKU = this.JoinSKU(SKUs[0],SKUs[1],SKUs[2]);
                return SKU;
            }
        }
        
               
        return false;       
    }
    FindMinQuantitySKU2(items, inititalItems){ 
        let k = items.length/2;       
        for(let i = items.length-1; i>=k; i -- ){      
        
                if(items[i-k].quantity > items[i].quantity){
                    items[i].quantity= inititalItems[i].quantity-items[i-k].quantity;
                    items[i-k].quantity= inititalItems[i-k].quantity-items[i-k].quantity;
                    if(items[i-k].quantity>items[i].quantity){
                        items[i-k].quantity=items[i].quantity;
                    }
                    else{
                        items[i].quantity=items[i-k].quantity;
                    }                    
    
                }         
                else if (items[i-k].quantity < items[i].quantity){
                    items[i].quantity= inititalItems[i].quantity-items[i].quantity;
                    items[i-k].quantity= inititalItems[i-k].quantity-items[i].quantity;
                    if(items[i-k].quantity>items[i].quantity){
                        items[i-k].quantity=items[i].quantity;
                    }
                    else{
                        items[i].quantity=items[i-k].quantity;
                    }        
                }            
        }
        return items   
    }

    FindMinQuantitySKU3(items, inititalItems) {
        let k = items.length / 3;
        for (let i = items.length - 1; i >= 2 * k; i--) {

            if (items[i - k].quantity >= items[i].quantity && items[i - k].quantity >= items[i - 2 * k].quantity) {
                items[i].quantity = inititalItems[i].quantity - items[i - k].quantity;
                items[i - k].quantity = inititalItems[i - k].quantity - items[i - k].quantity;
                items[i - 2 * k].quantity = inititalItems[i - k].quantity - items[i - k].quantity;
                if (items[i - k].quantity <= items[i].quantity && items[i - k].quantity <= items[i - 2 * k].quantity) {
                    items[i - 2 * k].quantity = items[i - k].quantity;
                    items[i].quantity  = items[i - k].quantity;
                    
                }
                else if (items[i - 2 * k].quantity <= items[i].quantity && items[i - 2 * k].quantity <= items[i - k].quantity) {
                    items[i].quantity = items[i - 2 * k].quantity;
                    items[i - k].quantity = items[i - 2 * k].quantity;
                }
                else if (items[i].quantity <= items[i - k].quantity && items[i].quantity <= items[i - 2 * k].quantity) {
                    items[i - 2 * k].quantity = items[i].quantity;
                    items[i - k].quantity = items[i].quantity;
                   
                }

            }
            else if (items[i].quantity >= items[i - k].quantity  && items[i].quantity >= items[i - 2 * k].quantity) {
                items[i].quantity = inititalItems[i].quantity - items[i].quantity;
                items[i - k].quantity = inititalItems[i - k].quantity - items[i].quantity;
                items[i - 2 * k].quantity = inititalItems[i - k].quantity - items[i].quantity;
                if (items[i - k].quantity <= items[i].quantity && items[i - k].quantity <= items[i - 2 * k].quantity) {
                    items[i - 2 * k].quantity = items[i - k].quantity;
                    items[i].quantity  = items[i - k].quantity;
                    
                }
                else if (items[i - 2 * k].quantity <= items[i].quantity && items[i - 2 * k].quantity <= items[i - k].quantity) {
                    items[i].quantity = items[i - 2 * k].quantity;
                    items[i - k].quantity = items[i - 2 * k].quantity;
                }
                else if (items[i].quantity <= items[i - k].quantity && items[i].quantity <= items[i - 2 * k].quantity) {
                    items[i - 2 * k].quantity = items[i].quantity;
                    items[i - k].quantity = items[i].quantity;
                   
                }

                
            }
            else if (items[i - 2 * k].quantity >= items[i].quantity && items[i - k].quantity <= items[i - 2 * k].quantity) {
                items[i].quantity = inititalItems[i].quantity - items[i - 2 * k].quantity;
                items[i - k].quantity = inititalItems[i - k].quantity - items[i - 2 * k].quantity;
                items[i - 2 * k].quantity = inititalItems[i - k].quantity - items[i - 2 * k].quantity;
                if (items[i - k].quantity <= items[i].quantity && items[i - k].quantity <= items[i - 2 * k].quantity) {
                    items[i - 2 * k].quantity = items[i - k].quantity;
                    items[i].quantity  = items[i - k].quantity;
                    
                }
                else if (items[i - 2 * k].quantity <= items[i].quantity && items[i - 2 * k].quantity <= items[i - k].quantity) {
                    items[i].quantity = items[i - 2 * k].quantity;
                    items[i - k].quantity = items[i - 2 * k].quantity;
                }
                else if (items[i].quantity <= items[i - k].quantity && items[i].quantity <= items[i - 2 * k].quantity) {
                    items[i - 2 * k].quantity = items[i].quantity;
                    items[i - k].quantity = items[i].quantity;
                   
                }
            }
        }
        return items
    }
    GetPackedItemQuantity(newitems, items, Initialitems){
        for(let i = 0; i<newitems.length; i++ ){
            newitems[i].quantity = Initialitems[i].quantity - items[i].quantity;                
        }
        return newitems;

    }

    FetchItemQuantityZero( newitems )
    {
        for(let i = 0; i<newitems.length; i++ ){

            newitems[i].quantity = 0;                
        }
        return newitems;
    }

    FetchItemQuantity( newitems, items )
    {
        for(let i = 0; i<items.length; i++ ){

            newitems[i].quantity = items[i].quantity;                
        }
        return newitems;
    }

    SetItemQuantity(items, newitems){
        for(let i = 0; i<items.length; i++ ){           

            items[i].quantity = newitems[i].quantity;                 
        }
        return items;
    }
    ItemQuantityRange( items, inititalItems){
        let count = 0;
        for(let i = 0; i<items.length; i++ ){
            if(items[i].quantity <= inititalItems[i].quantity) return true;
        }
        //if(count>0) 
        return false;
    }
    GetSchema(items){
        var schema = []
        for(let i = 0; i<items.length; i++ ){
            schema.push(items[i].quantity);         
        }
        // for(let i = 0; i<SKU2.length; i++ ){
        //     schema.push(SKU2[i].quantity);         
        // }
        // for(let i = 0; i<SKU3.length; i++ ){
        //     schema.push(SKU3[i].quantity);         
        // }
        return schema;
    }
    GetSKUS(items){
        var SKU1 = [];
        var SKU2 = [];
        var SKU3 = []; 
        for(let i = 0; i < items.length; i++){
            if(items[i].category === 'O1' || items[i].category === 'S1') SKU1.push(items[i]);
            if(items[i].category === 'O2' || items[i].category === 'I2') SKU2.push(items[i]);
            if(items[i].category === 'O3' || items[i].category === 'I3' || items[i].category === 'S3') SKU3.push(items[i]);
        }
        return [SKU1, SKU2, SKU3];
    }
    CheckPairedItems(items){
       let SKUs = this.GetSKUS(items);
      // console.log(SKUs[1],'SKU2', SKUs[2], 'SKU3');
       if(SKUs[1].length> 0){
           if(!this.CheckPairedItemsSKU2(SKUs[1]))  return false;
       }
       if(SKUs[2].length> 0){
           if(!this.CheckPairedItemsSKU3(SKUs[2]))  return false;
       }
       return true;  

    }
    JoinSKU(SKU1, SKU2, SKU3)
    {
        let JoinedSKU = [];
        if(SKU1){
            for(let i = 0; i<SKU1.length; i++ ){
                JoinedSKU.push(SKU1[i]);         
            }
        }
        if(SKU2){
        for(let i = 0; i<SKU2.length; i++ ){
            JoinedSKU.push(SKU2[i]);         
        }
        }
        if(SKU1){
        for(let i = 0; i<SKU3.length; i++ ){
            JoinedSKU.push(SKU3[i]);         
        }
    }
        return JoinedSKU;
    }
    async PackSKUs(container, items, heuristic)
    {
        
        let SKUs = this.GetSKUS(items);
        let finalSchema = [];
        //let InititalSKU1 = this.GetItemDetails(SKUs[0]);
        let finalSKU1 = this.GetItemDetails(SKUs[0]);
        let finalSKU2 = this.GetItemDetails(SKUs[1]);               
        let finalSKU3 = this.GetItemDetails(SKUs[2]);
        let finalSKUQty = this.JoinSKU(finalSKU1, finalSKU2, finalSKU3);
        let CombindedSKU = this.JoinSKU(SKUs[0], SKUs[1], SKUs[2]);        
        let Initialitems = this.GetItemDetails(finalSKUQty);
        // var results = await CUB.pack(container, SKUs[0], heuristic);
        // finalSKU1 = this.GetPackedItemQuantity(finalSKU1, SKUs[0], InititalSKU1);
        finalSKU1 = this.FetchItemQuantityZero(finalSKU1);
        finalSKU2 = this.FetchItemQuantityZero(finalSKU2);
        finalSKU3 = this.FetchItemQuantityZero(finalSKU3);
        finalSKUQty = this.JoinSKU(finalSKU1, finalSKU2, finalSKU3);        
        finalSKUQty = this.IncreementItemQuantity(finalSKUQty, Initialitems);        
        let tempQty = this.GetItemDetails(CombindedSKU);
        while(this.ItemQuantityRange(finalSKUQty, Initialitems)){
            CombindedSKU = this.SetItemQuantity(CombindedSKU, finalSKUQty)
                    var results = await CUB.pack(container, CombindedSKU, heuristic);

                    if(this.CheckPairedItems(CombindedSKU) === true ){
                        tempQty = this.GetPackedItemQuantity(tempQty, CombindedSKU, finalSKUQty)
                        var quantitySchema = this.GetSchema(tempQty)
                        finalSchema.push(quantitySchema)
                    } 
                    finalSKUQty = this.IncreementItemQuantity(finalSKUQty, Initialitems)
                    
            }
        //console.log(finalSchema)
        finalSchema.sort(function(a, b) {
            //console.log(a);
            function Sum(row){
                let sum = 0;
                for(let i=0; i<row.length; i++){
                    sum +=  row[i]
                }
                return sum;
            }
            if(Sum(a) < Sum(b)) return -1;
            if(Sum(a) > Sum(b)) return 1;
            return 0;        
        })
        
        let SKUQty =  finalSchema.pop();        
        return SKUQty;
            



    }

    
    
    /** @param {SolverParams} params */
    Solve(params){
        params = params || this[_solverParams];
        this[_solverParams] = params;

        this.solverExecutionsCount++;

        let algorithm = params.algorithm;
        let algorithmParams = params.algorithmParams;
        if(algorithm === 'cub')
            this.SolveCUB(algorithmParams);
    }

    /** @param {CUBParams} params */
    async SolveCUB(params){

        if(this.packingSpace.ready === false){
            this.Dispatch(signals.packFailed, 'Packing space not ready');
            return;
        }

        if(this.cargoList.ready === false){
            this.Dispatch(signals.packFailed, 'Cargo list not ready');
            return;
        }

        const Container = CUB.Container;
        const Item = CUB.Item;

        var containingVolume = this.packingSpace.current.volume;
        var d = containingVolume.dimensions;
        var container = new Container(containingVolume.uid, d.width, d.height, d.length, containingVolume.weightCapacity);
        var ZeroContainer = new Container(containingVolume.uid, d.width, d.height, d.length, 0);
        
        var numTotalItems = 0;

         /** @type {Array<Item>} */
         var items = [];                 
         var entries = {};
         var itemQuant=[];
        //  var ItemInfo=[];

         for(let group of this.cargoList.groups.values()){
            /** @type {BoxEntry} */
            
            let entry = group.entry;
            entries[entry.uid] = entry;
            d = entry.dimensions;
            let validOrientations = ['xyz'];
            let stackingCapacity = entry.properties.stacking.enabled ? entry.properties.stacking.capacity : (entry.weight > epsilon ? entry.weight * this.params.defaultStackingFactor : Number.MAX_SAFE_INTEGER - 10);
            let grounded = entry.properties.translation.enabled ? entry.properties.translation.grounded : false;
            let item = new Item(entry.uid, entry.label, d.width, d.height, d.length, entry.weight, entry.quantity, validOrientations, stackingCapacity, grounded);
            items.push(item);
            itemQuant.push(item.quantity);        
            numTotalItems += entry.quantity;
            // ItemInfo.push([item.id,item.quantity,entry.label.toLowerCase().replace(" ", "")])
        }
        
        let ItemIDS = this.GetItemIds(items)
        let InititalItems = this.GetItemDetails(items)
        var startTime = performance.now();
        let heuristicParams = extractHeuristicParams({score_minLength: 0.9, score_minWastedSpace: 0.09999999999999998});
        let heuristic = new CUB.heuristics.HeuParametric1(heuristicParams, ItemIDS);
        let finalItems = await this.PackSKUs(container, items, heuristic)
        console.log(finalItems);
            for(let i = 0; i<items.length; i++ ){
                items[i].quantity = finalItems[i];   
            }      
            
        var results = await CUB.pack(container, items, heuristic); 

            for(let i = 0; i<items.length; i++ ){
                items[i].quantity = InititalItems[i].quantity-finalItems[i];   
            }
        
        var unpackResult = await CUB.pack(ZeroContainer, items, heuristic);
                   
        

        
        var cubRuntime = performance.now() - startTime;
        var cubRuntime2Dec = Math.round(cubRuntime / 1000 * 100) / 100;
        var packingResult = new PackingResult(numTotalItems, cubRuntime2Dec);
        
        results.packedItems.forEach(packedItem => {
            let entry = entries[packedItem.ref.id];
            let position = new THREE.Vector3(
                packedItem.x + packedItem.packedWidth / 2,
                packedItem.y + packedItem.packedHeight / 2,
                packedItem.z + packedItem.packedLength / 2
            );
            let orientation = Item.ResolveOrientation(packedItem.orientation);
            let packedCargo = new PackedCargo(entry, containingVolume, position, orientation);
            packingResult.packed.push(packedCargo);
        });

        unpackResult.unpackedItems.forEach(unpackedItem => {
            let entry = entries[unpackedItem.id];
            let unpackedQuantity = unpackedItem.quantity;
            let unpackedCargo = new UnpackedCargo(entry, unpackedQuantity);
            packingResult.unpacked.push(unpackedCargo);
        });

        console.log(packingResult,"Output");
        
        this.Dispatch(signals.packUpdate, packingResult);
    }

    get solveAgain(){
        return this.solverExecutionsCount > 0;
    }

    static get signals(){
        return signals;
    }

}

Packer.PackingResult = PackingResult;
Packer.PackedCargo = PackedCargo;
Packer.UnpackedCargo = UnpackedCargo;

export default Packer;
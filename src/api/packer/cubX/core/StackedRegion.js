import OccupiedRegions from "./OccupiedRegion";

const maxWeightValue = Number.MAX_SAFE_INTEGER;
class StackedRegions extends OccupiedRegions{
    constructor(x, y, z, width, height, length, item,  preferredX){
        super()
        this.Set(x, y, z, width, height, length,  item, preferredX);
        this.SetWeights(0, maxWeightValue, maxWeightValue);
        this.stackCount = 1;
        return this;
    }
    SetStack(value){
        this.stackCount = this.stackCount+value;
    }
    UpdateStack(x, y, z, width, height, length, item, count, preferredX){          
        this.Set(x, y, z, width, height, length,  item, preferredX)
        this.SetStack(count)
    }
    
    Set(x, y, z, width, height, length,  item, preferredX){
        this.x = x; this.y = y; this.z = z;
        this.width = width; this.height = height; this.length = length;
        this.ref = item;        
        this.preferredX = preferredX;        
        return this;
    }
    SetWeights(weight, weightCapacity, stackingCapacity){
        this.weight = weight;
        this.weightCapacity = weightCapacity;
        this.stackingCapacity = stackingCapacity;
    } 
}
export default StackedRegions;
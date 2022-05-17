

const maxWeightValue = Number.MAX_SAFE_INTEGER;

class OccupiedRegions {
    constructor(x, y, z, width, height, length, item, level, preferredX){
        this.Set(x, y, z, width, height, length, level, preferredX);
        this.SetWeights(0, maxWeightValue, maxWeightValue);
        this.ref = item;        
        return this;
    }

    OnTopRegion(regionA, regionB){
        var xB = regionB.x, yB = regionB.y, zB = regionB.z;
        var wB = regionB.width, hB = regionB.height, lB = regionB.length;
        var xT = regionA.x, yT = regionA.y, zT = regionA.z;
        var wT = regionA.width, hT = regionA.height, lT = regionA.length;
        if (xT > xB - wT  && xT < xB + wB + wT  && zT > zB - lT  && zT < zB + lB + lT && yT === yB + hB) return true;
        else return false;       
    }

    Set(x, y, z, width, height, length, level, preferredX){
        this.x = x; this.y = y; this.z = z;
        this.width = width; this.height = height; this.length = length;
        this.level = level;
        this.preferredX = preferredX;        
        return this;
    }
    
    /**
     * @param {Number} weight 
     * @param {Number} weightCapacity 
     * @param {Number} stackingCapacity 
     */
    SetWeights(weight, weightCapacity, stackingCapacity){
        this.weight = weight;
        this.weightCapacity = weightCapacity;
        this.stackingCapacity = stackingCapacity;
    }    
}
export default OccupiedRegions;
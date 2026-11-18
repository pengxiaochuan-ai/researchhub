// Classification and transport bounds only; never authorization or parent proof.
export const isBusinessAssetId=x=>typeof x==='string'&&/^rhab-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(x);
export const assetVersionCeiling=id=>isBusinessAssetId(id)?2147483647:8;
export const assetEventCeiling=id=>isBusinessAssetId(id)?2147483647:24;
export const assetVersionInRange=(id,n)=>Number.isSafeInteger(n)&&n>0&&n<=assetVersionCeiling(id);

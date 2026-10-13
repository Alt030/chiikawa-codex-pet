function constrainBounds(bounds,area){
 const width=Math.min(Math.max(1,Math.round(bounds.width)),area.width);
 const height=Math.min(Math.max(1,Math.round(bounds.height)),area.height);
 return {x:Math.round(Math.max(area.x,Math.min(area.x+area.width-width,bounds.x))),y:Math.round(Math.max(area.y,Math.min(area.y+area.height-height,bounds.y))),width,height};
}
module.exports={constrainBounds};

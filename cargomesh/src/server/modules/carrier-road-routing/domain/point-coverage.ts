type XY=[number,number];
/** Unsupported global/dateline or degenerate rings remain unknown, never an automatic inclusion. */
export function pointInPolygon(point:{lat:number;lng:number},rings:XY[][]):'yes'|'no'|'unknown'{
 const epsilon=1e-10;
 // Bound quadratic validation work on persisted polygons; oversized shapes need a spatial adapter.
 if(rings.reduce((n,r)=>n+r.length,0)>256)return 'unknown';
 const cross=(a:XY,b:XY,c:XY)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const on=(a:XY,b:XY,c:XY)=>Math.abs(cross(a,b,c))<=epsilon&&c[0]>=Math.min(a[0],b[0])-epsilon&&c[0]<=Math.max(a[0],b[0])+epsilon&&c[1]>=Math.min(a[1],b[1])-epsilon&&c[1]<=Math.max(a[1],b[1])+epsilon;
 const intersects=(a:XY,b:XY,c:XY,d:XY)=>on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b)||cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0;
 // A bow-tie or intersecting rings cannot define an affirmative service area.
 for(let r=0;r<rings.length;r++)for(let i=0;i<rings[r].length-1;i++){
  const a=rings[r][i],b=rings[r][i+1];if(a[0]===b[0]&&a[1]===b[1])return 'unknown';
  for(let q=r;q<rings.length;q++)for(let j=q===r?i+1:0;j<rings[q].length-1;j++){
   if(q===r&&(j===i+1||i===0&&j===rings[r].length-2))continue;
   if(intersects(a,b,rings[q][j],rings[q][j+1]))return 'unknown';
  }
 }
 function ring(points:XY[]):'inside'|'outside'|'boundary'|'invalid'{
  if(points.length<4||points[0][0]!==points.at(-1)![0]||points[0][1]!==points.at(-1)![1])return 'invalid';
  let area=0;for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1];if(Math.abs(a[0]-b[0])>180)return 'invalid';area+=a[0]*b[1]-b[0]*a[1];}
  if(Math.abs(area)<=epsilon)return 'invalid';
  let inside=false;
  for(let i=0;i<points.length-1;i++){
   const a=points[i],b=points[i+1];if(Math.abs(a[0]-b[0])>180)return 'invalid';
   const cross=(point.lng-a[0])*(b[1]-a[1])-(point.lat-a[1])*(b[0]-a[0]);
   if(Math.abs(cross)<=epsilon&&point.lng>=Math.min(a[0],b[0])-epsilon&&point.lng<=Math.max(a[0],b[0])+epsilon&&point.lat>=Math.min(a[1],b[1])-epsilon&&point.lat<=Math.max(a[1],b[1])+epsilon)return 'boundary';
   if((a[1]>point.lat)!==(b[1]>point.lat)&&point.lng<(b[0]-a[0])*(point.lat-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside?'inside':'outside';
 }
 const results=rings.map(ring);if(!results.length||results.includes('invalid'))return 'unknown';
 if(results[0]==='outside')return 'no';
 // Boundaries are treated as belonging to the published polygon. Evidenced exclusions win later.
 if(results.includes('boundary'))return 'yes';
 return results.slice(1).includes('inside')?'no':'yes';
}

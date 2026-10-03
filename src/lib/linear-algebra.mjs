/** Small, explicit operations for the Chapter 6 teaching examples. */
export function vector(values){
  if(!Array.isArray(values)||!values.length||!values.every(v=>typeof v==='number'&&Number.isFinite(v)))throw new Error('Expected a nonempty vector of finite numbers.');
  return values;
}
export function dot(a,b){
  vector(a);vector(b);
  if(a.length!==b.length)throw new Error('Dot product needs equal vector lengths.');
  return a.reduce((total,value,i)=>total+value*b[i],0);
}
export function norm(values){return Math.hypot(...vector(values));}
export function cosine(a,b){
  const product=dot(a,b),denominator=norm(a)*norm(b);
  return denominator===0?null:Math.max(-1,Math.min(1,product/denominator));
}
export function matvec(matrix,values){
  vector(values);
  if(!Array.isArray(matrix)||!matrix.length)throw new Error('Expected a nonempty matrix.');
  return matrix.map(row=>dot(row,values));
}
export const transforms=[
  {id:'identity',label:'Identity',matrix:[[1,0],[0,1]],explanation:'Both coordinates stay unchanged. Every input vector is preserved.'},
  {id:'stretch',label:'Stretch horizontally',matrix:[[2,0],[0,1]],explanation:'Double the first coordinate and keep the second. Lengths generally change.'},
  {id:'rotate',label:'Rotate 90° counterclockwise',matrix:[[0,-1],[1,0]],explanation:'The output is (−u₂, u₁). Length is preserved and the direction turns by 90° for a nonzero vector.'},
  {id:'shear',label:'Shear horizontally',matrix:[[1,1],[0,1]],explanation:'Add the second coordinate to the first. The second coordinate stays unchanged.'},
  {id:'collapse',label:'Project onto the horizontal axis',matrix:[[1,0],[0,0]],explanation:'Discard the second coordinate. Different inputs can now produce the same output.'},
];

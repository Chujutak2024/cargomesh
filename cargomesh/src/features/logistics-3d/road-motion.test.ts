import assert from "node:assert/strict";
import test from "node:test";
import {roadPositionAt} from "./road-motion";

test("roadside moves past the truck and wraps outside the visible foreground",()=>{
  assert.equal(roadPositionAt(-10,0),-10);
  assert.equal(roadPositionAt(-10,5),-5);
  assert.equal(roadPositionAt(39,2),-39);
  assert.equal(roadPositionAt(-10,80),-10);
  for(let distance=0;distance<10000;distance+=.37){
    const position=roadPositionAt(17,distance); assert.ok(position>=-40&&position<40);
  }
});

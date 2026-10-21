import test from 'node:test';
import assert from 'node:assert/strict';
import {workspaceSwitchDecision,workspaceSwitchGuard} from './switch-guard';
const empty={origin:'',cargo:'',quantity:0};
const state={phase:'idle',hasRequest:false,dirtyAfterCreate:false,draft:empty,emptyDraft:empty};
test('new empty and saved clean are safe, new form/chat edits and saved edits require consent',()=>{
 assert.equal(workspaceSwitchGuard(state),'ready');
 assert.equal(workspaceSwitchGuard({...state,draft:{...empty,cargo:'12 pallets'}}),'unsaved');
 assert.equal(workspaceSwitchGuard({...state,hasRequest:true,draft:{...empty,cargo:'persisted'}}),'ready');
 assert.equal(workspaceSwitchGuard({...state,hasRequest:true,dirtyAfterCreate:true}),'unsaved');
});
test('in-flight create/revision/read/evaluation cannot switch the browser identity',()=>{
 for(const phase of ['creating','revising','reading','evaluating'])assert.equal(workspaceSwitchGuard({...state,phase}),'busy');
});
test('before-switch detail requests a React confirmation without cancelling or submitting',()=>{
 assert.deepEqual(workspaceSwitchDecision({workspace:'carrier'},false),{kind:'ready'});
 assert.deepEqual(workspaceSwitchDecision({workspace:'carrier',confirmation:' Unsaved draft '},false),{kind:'confirmation',message:'Unsaved draft'});
});
test('a busy or externally cancelled switch wins over an unsaved confirmation',()=>{
 assert.deepEqual(workspaceSwitchDecision({workspace:'client',confirmation:'Discard?',blockedReason:' Operation in progress '},true),{kind:'blocked',message:'Operation in progress'});
 assert.deepEqual(workspaceSwitchDecision({workspace:'client',confirmation:'Discard?'},true),{kind:'blocked',message:''});
 assert.deepEqual(workspaceSwitchDecision({workspace:'client',blockedReason:'Busy'},false),{kind:'blocked',message:'Busy'});
});
test('optional guard copy is bounded and malformed or empty copy cannot become consent',()=>{
 assert.deepEqual(workspaceSwitchDecision({workspace:'carrier',confirmation:'  '},false),{kind:'ready'});
 assert.equal((workspaceSwitchDecision({workspace:'carrier',confirmation:'x'.repeat(1000)},false) as {message:string}).message.length,500);
 assert.deepEqual(workspaceSwitchDecision({workspace:'client',confirmation:{} as string},true),{kind:'blocked',message:''});
});

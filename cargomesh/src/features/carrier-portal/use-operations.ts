"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {createOperations,decodeOperations,OPERATIONS_KEY,OperationsSchema,registeredFleet,type OperationsState} from "./operations-model";
import {exampleFleet} from "./fleet-model";
const eventName="cargomesh-operations-changed";
export function useOperations(){
  const [state,setState]=useState(createOperations),[ready,setReady]=useState(false),[issue,setIssue]=useState("");
  useEffect(()=>{const read=()=>{try {const raw=localStorage.getItem(OPERATIONS_KEY),saved=decodeOperations(raw);if(raw&&!saved){setIssue("No se pudieron leer las operaciones guardadas. Se conservó la copia original.");return;}setState(saved??createOperations());}catch{setIssue("El almacenamiento del navegador no está disponible.");}finally{setReady(true);}};read();window.addEventListener(eventName,read);window.addEventListener("storage",read);return()=>{window.removeEventListener(eventName,read);window.removeEventListener("storage",read);};},[]);
  const commit=useCallback((transform:(current:OperationsState)=>OperationsState)=>{if(!ready||issue)return false;try {const raw=localStorage.getItem(OPERATIONS_KEY),current=decodeOperations(raw)??(raw?null:createOperations());if(!current)throw new Error("No se pudo recuperar el estado guardado.");if(current.revision!==state.revision)throw new Error("Los datos cambiaron en otra pantalla. Revisa el estado actualizado e inténtalo otra vez.");const next=OperationsSchema.parse(transform(current));localStorage.setItem(OPERATIONS_KEY,JSON.stringify(next));setState(next);window.dispatchEvent(new Event(eventName));return true;}catch(error){setIssue(error instanceof Error&&error.name==="ZodError"?"Revisa los campos: hay un valor incompleto o fuera del rango permitido.":error instanceof Error?error.message:"No se pudieron guardar los cambios.");return false;}},[ready,issue,state.revision]);
  const clearIssue=()=>setIssue("");
  const inventory=useMemo(()=>[...exampleFleet(),...registeredFleet(state.vehicles,state.carriers)],[state.vehicles,state.carriers]);
  return {state,ready,issue,clearIssue,commit,inventory};
}

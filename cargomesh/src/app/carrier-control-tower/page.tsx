import type { Metadata } from 'next';
import {requireDemoPageAccess as assertVisualDemo} from "@/server/demo/access";
import { ControlTower } from '@/features/carrier-control-tower/control-tower';
export const metadata:Metadata={title:'Control tower · CargoMesh Preview',description:'A simulated Carrier control tower using Google Maps.'};
export default async function Page(){await assertVisualDemo();return <ControlTower/>;}

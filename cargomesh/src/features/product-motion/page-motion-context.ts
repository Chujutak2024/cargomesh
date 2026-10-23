'use client';
import { createContext } from 'react';

/** A page-level reveal owns movement; nested regions still own focus/readiness. */
export const PageMotionContext = createContext(false);

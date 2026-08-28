"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

interface DemoModeContextType {
  isDemoMode: boolean;
  setDemoMode: (enabled: boolean) => void;
  toggleDemoMode: () => void;
  isHowItWorksOpen: boolean;
  openHowItWorks: () => void;
  closeHowItWorks: () => void;
}

const DemoModeContext = createContext<DemoModeContextType>({
  isDemoMode: false,
  setDemoMode: () => {},
  toggleDemoMode: () => {},
  isHowItWorksOpen: false,
  openHowItWorks: () => {},
  closeHowItWorks: () => {},
});

export const DemoModeProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState<boolean>(false);

  useEffect(() => {
    // Check URL param ?demo=true or localStorage
    const params = new URLSearchParams(window.location.search);
    const demoParam = params.get("demo");
    const stored = localStorage.getItem("cargomesh_demo_mode");

    if (demoParam === "true" || stored === "true") {
      setIsDemoMode(true);
    }
  }, []);

  const setDemoMode = (enabled: boolean) => {
    setIsDemoMode(enabled);
    localStorage.setItem("cargomesh_demo_mode", enabled ? "true" : "false");
  };

  const toggleDemoMode = () => {
    setDemoMode(!isDemoMode);
  };

  return (
    <DemoModeContext.Provider
      value={{
        isDemoMode,
        setDemoMode,
        toggleDemoMode,
        isHowItWorksOpen,
        openHowItWorks: () => setIsHowItWorksOpen(true),
        closeHowItWorks: () => setIsHowItWorksOpen(false),
      }}
    >
      {children}
    </DemoModeContext.Provider>
  );
};

export const useDemoMode = () => useContext(DemoModeContext);

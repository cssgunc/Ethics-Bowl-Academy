"use client";

import { useState, useEffect, useRef } from "react";
import { getPublicModules } from "@/lib/firebase/db-operations";

interface Module {
  id: string;
  title: string;
  order: number;
}

interface SidebarProps {
  selectedModule: string;
  onSelect: (moduleId: string) => void;
  onSelectIndex: (index: number) => void;
}

export default function Sidebar({ selectedModule, onSelect, onSelectIndex }: SidebarProps) {
  const [modules, setModules] = useState<Module[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleModuleClick = (moduleId: string) => {
    onSelect(moduleId);
    onSelectIndex(modules.findIndex(mod => mod.id === moduleId));
  };

  useEffect(() => {
    const fetchModules = async () => {
      const modulesData = await getPublicModules();
      const mappedModules = modulesData
        .map(mod => ({
          id: mod.id,
          title: mod.title,
          order: mod.order || 999
        }))
        .sort((a, b) => a.order - b.order);
      setModules(mappedModules);
    };
    fetchModules();
  }, []);

  useEffect(() => {
    if (modules.length > 0 && !selectedModule) {
      onSelect(modules[0].id);
      onSelectIndex(0);
    }
  }, [modules]);

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:block w-60 shrink-0 bg-white border border-gray-300 overflow-y-auto font-secondary rounded-l-xl max-h-[calc(100vh-120px)]">
        <nav>
          {modules.map((module, index) => (
            <div key={module.id} className={`${index < modules.length - 1 ? "border-b border-gray-300" : ""}`}>
              <button
                onClick={() => handleModuleClick(module.id)}
                className={`w-full text-left pr-4 px-6 py-5 transition-colors duration-200 ${
                  selectedModule === module.id
                    ? "bg-light-carolina-blue text-black"
                    : "bg-white text-black hover:bg-gray-50"
                }`}
              >
                <div className="space-y-2">
                  <div
                    className={`text-md leading-relaxed ${
                      selectedModule === module.id ? "text-black font-bold" : "text-black font-normal"
                    }`}
                  >
                    Module {index + 1}
                    <br />
                    {module.title}
                  </div>
                </div>
              </button>
            </div>
          ))}
        </nav>
      </div>

      {/* Mobile horizontal scrollable bar */}
      <div
        ref={scrollRef}
        className="flex md:hidden overflow-x-auto gap-2 px-3 py-3 bg-white border-b border-gray-300 -mx-0"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <style jsx>{`div::-webkit-scrollbar { display: none; }`}</style>
        {modules.map((module, index) => (
          <button
            key={module.id}
            onClick={() => handleModuleClick(module.id)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors duration-200 border ${
              selectedModule === module.id
                ? "bg-light-carolina-blue text-black border-blue-300 font-bold"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            Module {index + 1}: {module.title}
          </button>
        ))}
      </div>
    </>
  );
}

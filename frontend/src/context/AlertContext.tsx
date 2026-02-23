"use client";

import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import AlertDialog from "@/components/AlertDialog";

type AlertType = "info" | "success" | "warning" | "error" | "confirm";

interface AlertContextType {
    showAlert: (title: string, message: string, type?: AlertType) => Promise<void>;
    showConfirm: (title: string, message: string) => Promise<boolean>;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [message, setMessage] = useState("");
    const [type, setType] = useState<AlertType>("info");

    // Ref to hold the resolve function for the Promise
    const resolveRef = useRef<((value: any) => void) | null>(null);

    const showAlert = useCallback((title: string, message: string, type: AlertType = "info"): Promise<void> => {
        return new Promise((resolve) => {
            setTitle(title);
            setMessage(message);
            setType(type);
            setIsOpen(true);
            resolveRef.current = resolve;
        });
    }, []);

    const showConfirm = useCallback((title: string, message: string): Promise<boolean> => {
        return new Promise((resolve) => {
            setTitle(title);
            setMessage(message);
            setType("confirm");
            setIsOpen(true);
            resolveRef.current = resolve;
        });
    }, []);

    const handleConfirm = () => {
        setIsOpen(false);
        if (resolveRef.current) {
            if (type === "confirm") {
                resolveRef.current(true);
            } else {
                resolveRef.current(undefined);
            }
            resolveRef.current = null;
        }
    };

    const handleCancel = () => {
        setIsOpen(false);
        if (resolveRef.current) {
            if (type === "confirm") {
                resolveRef.current(false);
            } else {
                resolveRef.current(undefined);
            }
            resolveRef.current = null;
        }
    };

    return (
        <AlertContext.Provider value={{ showAlert, showConfirm }}>
            {children}
            <AlertDialog
                isOpen={isOpen}
                title={title}
                message={message}
                type={type}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
            />
        </AlertContext.Provider>
    );
}

export function useAlert() {
    const context = useContext(AlertContext);
    if (context === undefined) {
        throw new Error("useAlert must be used within an AlertProvider");
    }
    return context;
}

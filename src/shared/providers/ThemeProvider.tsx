import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";

import { dark, light, Theme } from "@/shared/constants/theme";

type ThemeMode = "light" | "dark" | "system";

interface ThemeContextType {
    theme: Theme;
    mode: ThemeMode;
    setMode: (mode: ThemeMode) => void;
    isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = "app_theme_mode";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const systemColorScheme = useColorScheme();
    const [mode, setModeState] = useState<ThemeMode>("system");

    useEffect(() => {
        const loadTheme = async () => {
            const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
            if (savedMode) {
                setModeState(savedMode as ThemeMode);
            }
        };
        loadTheme();
    }, []);

    const setMode = async (newMode: ThemeMode) => {
        setModeState(newMode);
        await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
    };

    const isDark = mode === "system" ? systemColorScheme === "dark" : mode === "dark";
    const theme = isDark ? dark : light;

    return (
        <ThemeContext.Provider value={{ theme, mode, setMode, isDark }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
}

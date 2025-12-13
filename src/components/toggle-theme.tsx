import { Moon, Sun } from "lucide-react";
import { setTheme, getCurrentTheme } from "@/actions/theme";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export default function ToggleTheme() {
  const { t } = useTranslation();
  const [currentTheme, setCurrentTheme] = useState<string>("light");

  useEffect(() => {
    getCurrentTheme().then(({ local, system }) => {
      setCurrentTheme(local || system);
    });
  }, []);

  const handleThemeChange = (value: string) => {
    if (value) {
      setTheme(value as "light" | "dark" | "system");
      setCurrentTheme(value);
    }
  };

  return (
    <ToggleGroup type="single" value={currentTheme} onValueChange={handleThemeChange}>
      <ToggleGroupItem value="light" variant="outline" size="lg">
        <Sun size={16} className="mr-2" />
        {t("lightTheme")}
      </ToggleGroupItem>
      <ToggleGroupItem value="dark" variant="outline" size="lg">
        <Moon size={16} className="mr-2" />
        {t("darkTheme")}
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

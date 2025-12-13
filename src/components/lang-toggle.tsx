import langs from "@/localization/langs";
import { useTranslation } from "react-i18next";
import { setAppLanguage } from "@/actions/language";

export default function LangToggle() {
  const { i18n, t } = useTranslation();
  const currentLang = i18n.language;

  function onValueChange(value: string) {
    setAppLanguage(value, i18n);
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium leading-none">
        {t("selectLanguage")}
      </label>
      <ToggleGroup
        type="single"
        onValueChange={onValueChange}
        value={currentLang}
      >
        {langs.map((lang) => (
          <ToggleGroupItem
            key={lang.key}
            value={lang.key}
            variant="outline"
            size="lg"
          >
            {`${lang.prefix}`}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

import { default_language, target_language } from "../../language_code";

export const combinedLanguages = default_language.map(dl => {
    const target = target_language.find(tl =>
      dl.name.toLowerCase().includes(tl.name.toLowerCase())
    );
  
    return {
      name: dl.name,
      code: dl.code,
      transCode: target?.code || null,
    };
  });
  
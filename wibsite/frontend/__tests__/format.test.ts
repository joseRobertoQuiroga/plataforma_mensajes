import { scoreCategory, scoreLabel, scoreClasses, channelLabel, channelClasses, formatDate, STATE_LABELS, initials } from "../src/lib/format";

describe("lib/format — utilidades Wibsite 2.0", () => {
  test("scoreCategory clasifica correctamente", () => {
    expect(scoreCategory(0)).toBe("unscored");
    expect(scoreCategory(30)).toBe("cold");
    expect(scoreCategory(50)).toBe("warm");
    expect(scoreCategory(85)).toBe("hot");
  });

  test("scoreLabel devuelve etiquetas en español", () => {
    expect(scoreLabel(0)).toBe("Sin score");
    expect(scoreLabel(85)).toBe("Caliente");
    expect(scoreLabel(55)).toBe("Tibio");
    expect(scoreLabel(20)).toBe("Frío");
  });

  test("scoreClasses contiene clases tailwind", () => {
    expect(scoreClasses(85)).toContain("bg-danger/10");
    expect(scoreClasses(55)).toContain("bg-warning/10");
    expect(scoreClasses(20)).toContain("bg-primary/10");
    expect(scoreClasses(0)).toContain("bg-surface-container-high");
  });

  test("channelLabel mapea canales", () => {
    expect(channelLabel("whatsapp")).toBe("WhatsApp");
    expect(channelLabel("telegram")).toBe("Telegram");
    expect(channelLabel("messenger")).toBe("Messenger");
    expect(channelLabel("desconocido")).toBe("desconocido");
    expect(channelLabel()).toBe("Web");
  });

  test("channelClasses devuelve estilos por canal", () => {
    expect(channelClasses("whatsapp")).toContain("#25D366");
    expect(channelClasses("telegram")).toContain("primary");
    expect(channelClasses("email")).toContain("warning");
  });

  test("formatDate maneja nulos y fechas válidas", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate(undefined)).toBe("—");
    expect(formatDate("2026-08-14T13:50:25.980Z")).toMatch(/ago/i);
  });

  test("STATE_LABELS cubre los estados del pipeline", () => {
    expect(STATE_LABELS.active).toBe("Activo");
    expect(STATE_LABELS.qualification).toBe("Calificando");
    expect(STATE_LABELS.closed).toBe("Cerrado");
  });

  test("initials extrae la inicial", () => {
    expect(initials("María García")).toBe("M");
    expect(initials(null)).toBe("?");
    expect(initials("")).toBe("?");
  });
});
export type SiteCategory = {
  id: string;
  label: string;
  icon: string;
};

export const defaultCategories: SiteCategory[] = [
  { id: "전체 콘텐츠", label: "전체 콘텐츠", icon: "⌂" },
  { id: "프롬프트", label: "프롬프트", icon: "✦" },
  { id: "AI 트렌드", label: "AI 트렌드", icon: "↗" },
  { id: "업무 자동화", label: "업무 자동화", icon: "⚡" },
];

export type SiteSettings = {
  exploreTitle: string;
  categories: SiteCategory[];
  heroEyebrow: string;
  heroTitlePrimary: string;
  heroTitleAccent: string;
  heroDescription: string;
  statLabel: string;
  featuredLabel: string;
  featuredAllDescription: string;
  ideaTitle: string;
  ideaDescription: string;
  ideaButtonLabel: string;
  organizationLabel: string;
  articleEndBrand: string;
  articleEndText: string;
};

export const defaultSiteSettings: SiteSettings = {
  exploreTitle: "EXPLORE",
  categories: defaultCategories,
  heroEyebrow: "KNOWLEDGE LIBRARY",
  heroTitlePrimary: "일하는 방식을 바꾸는",
  heroTitleAccent: "AI 지식과 실습",
  heroDescription: "검증된 프롬프트와 실습 자료를 바로 복사하고, 다운로드해 업무에 적용해 보세요.",
  statLabel: "현재 카테고리 콘텐츠",
  featuredLabel: "FEATURED CONTENT",
  featuredAllDescription: "AI CoE가 엄선한 최신 콘텐츠",
  ideaTitle: "AI 활용 아이디어가 있나요?",
  ideaDescription: "AI CoE에 새로운 콘텐츠를 제안해 주세요.",
  ideaButtonLabel: "아이디어 제안",
  organizationLabel: "한화이센셜 AI Center of Excellence",
  articleEndBrand: "HANWHA",
  articleEndText: "AI를 가장 잘 쓰는 조직을 함께 만듭니다.",
};

type LegacySiteSettings = Partial<SiteSettings> & {
  categoryLabels?: Record<string, string>;
};

function textValue(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function normalizeCategories(value: LegacySiteSettings) {
  const source = Array.isArray(value.categories) && value.categories.length
    ? value.categories
    : defaultCategories.map((category) => ({ ...category, label: value.categoryLabels?.[category.id] || category.label }));
  const seen = new Set<string>();
  const categories = source.flatMap((category, index) => {
    const id = typeof category?.id === "string" && category.id.trim() ? category.id.trim() : `category-${index + 1}`;
    if (seen.has(id)) return [];
    seen.add(id);
    return [{ id, label: typeof category?.label === "string" && category.label.trim() ? category.label : "새 메뉴", icon: typeof category?.icon === "string" && category.icon ? category.icon : "＋" }];
  });
  if (!categories.some((category) => category.id === "전체 콘텐츠")) categories.unshift({ ...defaultCategories[0] });
  return categories;
}

export function normalizeSiteSettings(value: LegacySiteSettings | null | undefined): SiteSettings {
  const source = value ?? {};
  return {
    exploreTitle: textValue(source.exploreTitle, defaultSiteSettings.exploreTitle),
    categories: normalizeCategories(source),
    heroEyebrow: textValue(source.heroEyebrow, defaultSiteSettings.heroEyebrow),
    heroTitlePrimary: textValue(source.heroTitlePrimary, defaultSiteSettings.heroTitlePrimary),
    heroTitleAccent: textValue(source.heroTitleAccent, defaultSiteSettings.heroTitleAccent),
    heroDescription: textValue(source.heroDescription, defaultSiteSettings.heroDescription),
    statLabel: textValue(source.statLabel, defaultSiteSettings.statLabel),
    featuredLabel: textValue(source.featuredLabel, defaultSiteSettings.featuredLabel),
    featuredAllDescription: textValue(source.featuredAllDescription, defaultSiteSettings.featuredAllDescription),
    ideaTitle: textValue(source.ideaTitle, defaultSiteSettings.ideaTitle),
    ideaDescription: textValue(source.ideaDescription, defaultSiteSettings.ideaDescription),
    ideaButtonLabel: textValue(source.ideaButtonLabel, defaultSiteSettings.ideaButtonLabel),
    organizationLabel: textValue(source.organizationLabel, defaultSiteSettings.organizationLabel),
    articleEndBrand: textValue(source.articleEndBrand, defaultSiteSettings.articleEndBrand),
    articleEndText: textValue(source.articleEndText, defaultSiteSettings.articleEndText),
  };
}

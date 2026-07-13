export const categoryKeys = ["전체 콘텐츠", "프롬프트", "AI 트렌드", "업무 자동화"] as const;

export type CategoryKey = typeof categoryKeys[number];

export type SiteSettings = {
  exploreTitle: string;
  categoryLabels: Record<CategoryKey, string>;
};

export const defaultSiteSettings: SiteSettings = {
  exploreTitle: "EXPLORE",
  categoryLabels: {
    "전체 콘텐츠": "전체 콘텐츠",
    "프롬프트": "프롬프트",
    "AI 트렌드": "AI 트렌드",
    "업무 자동화": "업무 자동화",
  },
};

export function normalizeSiteSettings(value: Partial<SiteSettings> | null | undefined): SiteSettings {
  const labels = value?.categoryLabels ?? defaultSiteSettings.categoryLabels;
  return {
    exploreTitle: value?.exploreTitle?.trim() || defaultSiteSettings.exploreTitle,
    categoryLabels: Object.fromEntries(categoryKeys.map((key) => [key, labels[key]?.trim() || defaultSiteSettings.categoryLabels[key]])) as Record<CategoryKey, string>,
  };
}

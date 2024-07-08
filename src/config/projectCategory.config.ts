export const categoryBaseConfig = [
  {
    name: "spotdex",
    items: ["izumi", "wagmi", "novaswap"],
  },
  {
    name: "perpdex",
    items: ["logx", "zkdx"],
  },
  {
    name: "lending",
    items: ["layerbank", "aqua", "shoebill"],
  },
  // {
  //   name: "gamefi",
  //   items: [],
  // },
  {
    name: "nativeboost",
    items: ["novaswap"],
  },
  {
    name: "other",
    items: [
      "rubic",
      "interport",
      "orbiter",
      "symbiosis",
      "eddy",
      "meson",
      "allspark",
    ],
  },
];

const projectCategoryConfig = [];
for (const category of categoryBaseConfig) {
  for (const project of category.items) {
    projectCategoryConfig.push({
      category: category.name,
      project: project,
    });
  }
}

export default projectCategoryConfig;

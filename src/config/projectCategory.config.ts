export const categoryBaseConfig = [
  {
    name: "spotdex",
    items: ["izumi", "wagmi", "eddy", "novaswap"],
  },
  {
    name: "perpdex",
    items: ["logx", "zkdx"],
  },
  {
    name: "lending",
    items: ["layerbank", "aqua"],
  },
  {
    name: "gamefi",
    items: ["allspark"],
  },
  {
    name: "nativeboost",
    items: ["novaswap"],
  },
  {
    name: "other",
    items: ["rubic", "interport", "orbiter", "symbiosis", "meson"],
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

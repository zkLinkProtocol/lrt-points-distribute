const categoryBaseConfig = [
  {
    name: "spotdex",
    items: ["novaswap", "izumi", "wagmi", "eddyFinance"],
  },
  {
    name: "perpdex",
    items: ["logx", "zkdx"],
  },
  {
    name: "lending",
    items: ["layerbank", "nativeLend"],
  },
  {
    name: "gamefi",
    items: ["allspark"],
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

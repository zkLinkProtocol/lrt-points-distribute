export const categoryBaseConfig = [
  {
    name: "spotdex",
    items: ["izumi", "wagmi", "novaswap", "steer"],
  },
  {
    name: "perpdex",
    items: ["logx", "zkdx"],
  },
  {
    name: "lending",
    items: ["layerbank", "aqua", "shoebill", "desyn"],
  },
  // {
  //   name: "gamefi",
  //   items: [""],
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
      "zns",
      "sumer",
      "skyrangers",
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

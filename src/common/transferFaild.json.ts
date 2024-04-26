// address, tokenAddress, balance, decimal
const transferFaildData = [
  [
    "0x590f4590487Bd83D7A456b5DD2863810A076D1eC",
    "0x1B49eCf1A8323Db4abf48b2F5EFaA33F7DdAB3FC",
    "0.04",
    "18",
  ],
  [
    "0xF74BAC410bcF3c55af7A9A0CAef8F9c83087a3A4",
    "0xdA7Fa837112511F6E353091D7e388A4c45Ce7D6C",
    "1.85",
    "18",
  ],
  [
    "0xB84F419FD6DC9C30cCAA6ecbF5d194Af065A33ff",
    "0x7b1fcd81F8b91C5eF3743c4d56bf7C1E52c93360",
    "1.0499",
    "18",
  ],
  [
    "0x04c82fFd5dbA2ac0e00dD1F9Be955bd025Dec048",
    "0x1B49eCf1A8323Db4abf48b2F5EFaA33F7DdAB3FC",
    "0.9992",
    "18",
  ],
  [
    "0xd79ac3c872500fae339796227c0dFD16B38bD8b3",
    "0x7b1fcd81F8b91C5eF3743c4d56bf7C1E52c93360",
    "1.036",
    "18",
  ],
  [
    "0x63c43a9879AAac04127CB84105a5f2a3F9Bbba17",
    "0x1B49eCf1A8323Db4abf48b2F5EFaA33F7DdAB3FC",
    "0.489",
    "18",
  ],
  [
    "0xE26E90e8F6f1170fda099B771e483cD30d5ba2Af",
    "0x1B49eCf1A8323Db4abf48b2F5EFaA33F7DdAB3FC",
    "0.489",
    "18",
  ],
  [
    "0x33b9c350f495c77962406720b11b7e15e60fe9e4",
    "0x3FDB1939daB8e2d4F7a04212F142469Cd52d6402",
    "4.945",
    "18",
  ],
  [
    "0x9de842d48685406405d77ea2e691bcb640b1f66f",
    "0x3FDB1939daB8e2d4F7a04212F142469Cd52d6402",
    "0.2652",
    "18",
  ],
  [
    "0xd316a8ec11e7911197b9d9e743edc07a3fc5b55d",
    "0x3FDB1939daB8e2d4F7a04212F142469Cd52d6402",
    "2.02795776",
    "18",
  ],
  [
    "0x3fdd7dd264f3862680a7c0e7a43f2a6440aac347",
    "0x3FDB1939daB8e2d4F7a04212F142469Cd52d6402",
    "0.2375",
    "18",
  ],
  [
    "0xbd2ca315098e13e91f9a91a4744052d62c8e9092",
    "0x4A2da287deB06163fB4D77c52901683d69bD06f4",
    "0.25",
    "18",
  ],
  [
    "0x75411b249de43f61f138eedf775f2f5df1509ba1",
    "0x3FDB1939daB8e2d4F7a04212F142469Cd52d6402",
    "0.2651",
    "18",
  ],
  [
    "0x431fe42b533907325c2660883fa85e10f7ee8baa",
    "0x3FDB1939daB8e2d4F7a04212F142469Cd52d6402",
    "0.2686",
    "18",
  ],
  [
    "0x0e2a72b31659f6bf6ff2f0b63d1f060e6f132b5b",
    "0x3FDB1939daB8e2d4F7a04212F142469Cd52d6402",
    "0.2463",
    "18",
  ],
  [
    "0xd9135485f89a7020458702593881a0ec35cb20ab",
    "0x3FDB1939daB8e2d4F7a04212F142469Cd52d6402",
    "0.2463",
    "18",
  ],
  [
    "0x9f90230b05a8f3802923038eb99538000fc5a1cc",
    "0x4A2da287deB06163fB4D77c52901683d69bD06f4",
    "0.25055",
    "18",
  ],
  [
    "0x6b16602eb27141bd32b8b26402ea2e580637ae48",
    "0x3DabBd8A31a411E85f628278d6601fCeD82f6844",
    "0.04936338",
    "8",
  ],
  [
    "0x6d41672a2cd12d1939322bc7f0b10d8dfed1ff8f",
    "0x3FDB1939daB8e2d4F7a04212F142469Cd52d6402",
    "0.3957",
    "18",
  ],
  [
    "0xa3a061de24b29bdbe0898ad43ceb5635250653e8",
    "0x3FDB1939daB8e2d4F7a04212F142469Cd52d6402",
    "0.9996",
    "18",
  ],
  [
    "0xb6336d830cac61e713d2a607a22adabf2f75fc0a",
    "0x3FDB1939daB8e2d4F7a04212F142469Cd52d6402",
    "0.26",
    "18",
  ],
  [
    "0x0a335391047f06bd67af434314614b39c70499eb",
    "0x3FDB1939daB8e2d4F7a04212F142469Cd52d6402",
    "0.0575",
    "18",
  ],
  [
    "0x5b26ceb55e8925ad17ac996be44ff478cdabb778",
    "0x3FDB1939daB8e2d4F7a04212F142469Cd52d6402",
    "0.25",
    "18",
  ],
  [
    "0x42e29a7756d036f2d2eeb12f82d9ef25abf3361f",
    "0x3FDB1939daB8e2d4F7a04212F142469Cd52d6402",
    "0.00273",
    "18",
  ],
  [
    "0x05c4f2908a86a64ca1259aef34644c86fee07812",
    "0x3FDB1939daB8e2d4F7a04212F142469Cd52d6402",
    "0.27699",
    "18",
  ],
  [
    "0x428746258f091399a31c4539cb4be4c783e9a03a",
    "0x8FEe71Ab3Ffd6F8Aec8Cd2707Da20f4Da2bf583D",
    "0.251",
    "18",
  ],
  [
    "0xc6b4182118f69bac541fd903571c65e9a13e8a28",
    "0x8FEe71Ab3Ffd6F8Aec8Cd2707Da20f4Da2bf583D",
    "0.2533",
    "18",
  ],
  [
    "0xfcf4095e969f736580bdad3180fd20fc4db74ccb",
    "0x8FEe71Ab3Ffd6F8Aec8Cd2707Da20f4Da2bf583D",
    "0.44",
    "18",
  ],
  [
    "0xcb1f61a0b6f08bd7b0c78586456149743b3a93e2",
    "0x8FEe71Ab3Ffd6F8Aec8Cd2707Da20f4Da2bf583D",
    "0.254971",
    "18",
  ],
  [
    "0xbc9453b6a0f1d08dab770b47900dbe2ab0db432d",
    "0x8FEe71Ab3Ffd6F8Aec8Cd2707Da20f4Da2bf583D",
    "0.257",
    "18",
  ],
  [
    "0x4efb266c9d759bd2e1c02ea59e862f1763c532c4",
    "0x8FEe71Ab3Ffd6F8Aec8Cd2707Da20f4Da2bf583D",
    "0.25697",
    "18",
  ],
  [
    "0x7987e571755c4b91a9dc64d93e14fec95227545d",
    "0x8FEe71Ab3Ffd6F8Aec8Cd2707Da20f4Da2bf583D",
    "0.25344",
    "18",
  ],
  [
    "0xf6237e10c9c9f616b441be9396e7ca5446459078",
    "0x8FEe71Ab3Ffd6F8Aec8Cd2707Da20f4Da2bf583D",
    "0.01102",
    "18",
  ],
  [
    "0x7a5ccd948cacb9f6c2327537b272cc1903066d95",
    "0x8FEe71Ab3Ffd6F8Aec8Cd2707Da20f4Da2bf583D",
    "0.266",
    "18",
  ],
  [
    "0x251eb99f47402f1178b8294aecc91a02fa1fd13c",
    "0x8FEe71Ab3Ffd6F8Aec8Cd2707Da20f4Da2bf583D",
    "0.24999",
    "18",
  ],
  [
    "0x07180a326c92abc5d9be3cf9db524dbb87d5f687",
    "0x8FEe71Ab3Ffd6F8Aec8Cd2707Da20f4Da2bf583D",
    "0.25",
    "18",
  ],
  [
    "0xd485829b61bb27c8e6517a610401d429ac084d41",
    "0x8FEe71Ab3Ffd6F8Aec8Cd2707Da20f4Da2bf583D",
    "0.25",
    "18",
  ],
  [
    "0x2B9dC710e66D3D58a1Df78A6150dD14e1919DAf2",
    "0x60D49aAb4c150A172fefD4B5fFCc0BE41E655c18",
    "0.013",
    "8",
  ],
  [
    "0x4596c191aa6d26f5fa3d428c2bcdf3e57354a20b",
    "0x3FDB1939daB8e2d4F7a04212F142469Cd52d6402",
    "0.3235",
    "18",
  ],
];
export default transferFaildData;

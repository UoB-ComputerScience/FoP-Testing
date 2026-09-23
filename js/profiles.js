const starter = {
  "src/uk/ac/bradford/farmgame/Entity.java": "2c8c3b7da6edd630695e1f9e71de785babf13d26c7bd63065fd6b037243a7a76",
  "src/uk/ac/bradford/farmgame/GameEngine.java": "da8d3498545cc5b4a5869fadf173e04dfe8b4b2cc5e3f56ec14842b1a9647675",
  "src/uk/ac/bradford/farmgame/GameGUI.java": "f059c94da57ffdbb88c723f338644b24fb5086808642ee05bd38d48ef06ca7d8",
  "src/uk/ac/bradford/farmgame/InputHandler.java": "c336c1a04890834b75f5af6bea131481e04485d5f48334bdb92d30fec08d9ed4",
  "src/uk/ac/bradford/farmgame/Launcher.java": "00fbb7c4575fc5c6377118dbcd3124df921ab7312fe123aa8df4032da876658b",
  "src/uk/ac/bradford/farmgame/Pest.java": "417c9722dbcce66824a12ee5afc4deea85ca1d014e1fed13ff1ff7f5a238cadb",
  "src/uk/ac/bradford/farmgame/Player.java": "9009fe017dbdc0d3ff47f20de9304b3d79bcffca8e46a2119d6ffe2d24894a39",
  "src/uk/ac/bradford/farmgame/Rock.java": "4f2daa67590afedca0f08fb96922df1473a3ab2837a68eb99d52f41d55edfc18",
  "src/uk/ac/bradford/farmgame/Tile.java": "ce735b947a122be91ab86da54391c93616ac0742312b1ed36b48880c32a1f260",
  "src/uk/ac/bradford/farmgame/Tree.java": "50353b3aaa7a617509574b1806dc60461ebb2e697472dbaa9144c90222e957ce"
};

export const CHECKER_VERSION = '0.1.1';
export const LIMITS = Object.freeze({ archiveBytes:25*1024*1024, expandedBytes:100*1024*1024, entryBytes:10*1024*1024, entries:4000, milliseconds:30000 });
export const PROFILES = [
  {
    id:'fop-2025-26', version:'1', name:'Fundamentals of Programming · 2025–26',
    shortName:'FoP coursework · 2025–26',
    description:'Fundamentals of Programming · Java / NetBeans · COS4016-B',
    checks:['java.sources','archive.extras','netbeans.project','fop.files','fop.starter','submission.report'],
    expectedProjectFiles:['build.xml','nbproject/project.xml','nbproject/project.properties','nbproject/build-impl.xml'],
    expectedSourceFiles:Object.keys(starter),
    sourceDirectory:'src', javaVersion:'24', starter,
    assets:['axeBox','bed','crop','dirt','hoeBox','houseFloor','pest','pickaxeBox','player','playerWithAxe','playerWithHoe','playerWithPick','playerWithSeeds','rock','seedBox','sowedDirt','stoneGround','tilledDirt','tree','wall'].map(n=>`assets/${n}.png`),
  },
  {
    id:'java-general', version:'1', name:'Generic Java project',
    description:'Basic archive and source-file checks, without coursework-specific requirements.',
    checks:['java.sources','archive.extras'],
  },
];

export function getProfile(id) {
  const profile = PROFILES.find(p=>p.id===id);
  if (!profile) throw new Error('Choose a recognised coursework profile.');
  return profile;
}

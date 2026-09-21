import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import "../styles/solar-configurator.css";
import EstimateRange from "./EstimateRange";
import RepeatSimulationButton from "./RepeatSimulationButton";
import { startVisibleRenderLoop } from "../lib/visible-render-loop";
import { trackConversion } from "../lib/conversion-events";

const PANEL_POWER_KW = 0.55;
const MONTHLY_YIELD_PER_KWP = 130;
const ENERGY_TARIFF = 0.95;
const MAX_VISUAL_SLOTS = 48;
const SUN_DIRECTIONS = [
  [-.88, .39, -.28],
  [-.66, .66, -.27],
  [-.34, .88, -.18],
  [0, .98, .08],
  [.34, .88, .2],
  [.66, .66, .26],
  [.88, .39, .2],
].map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize());

const propertyTypes = [
  { id: "terrea", label: "Casa térrea", detail: "Cobertura residencial", capacity: 32, icon: "home" },
  { id: "sobrado", label: "Sobrado", detail: "Dois pavimentos", capacity: 24, icon: "floors" },
  { id: "comercial", label: "Comércio", detail: "Cobertura mais ampla", capacity: 48, icon: "store" },
];

function PropertyIcon({ name }) {
  const paths = {
    home: <><path d="m3 11 9-7 9 7"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
    floors: <><rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M10 21v-3h4v3"/></>,
    store: <><path d="M3 9h18l-2-5H5L3 9Z"/><path d="M5 9v11h14V9M8 20v-6h8v6"/><path d="M3 9c0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0"/></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function ArrowIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>;
}

function ShadowIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 15.5A7.5 7.5 0 0 1 15.5 4 8.5 8.5 0 1 0 20 15.5H4Z"/><path d="M12 2v2M4.9 4.9l1.4 1.4M2 12h2"/></svg>;
}

function normalizePanelModel(source) {
  const content = source.clone(true);
  const template = new THREE.Group();
  template.add(content);
  let box = new THREE.Box3().setFromObject(content);
  const center = box.getCenter(new THREE.Vector3());
  content.position.sub(center);
  const size = box.getSize(new THREE.Vector3());
  const thinAxis = size.x <= size.y && size.x <= size.z ? "x" : size.z <= size.x && size.z <= size.y ? "z" : "y";
  if (thinAxis === "x") content.rotation.z = Math.PI / 2;
  if (thinAxis === "z") content.rotation.x = -Math.PI / 2;
  template.updateMatrixWorld(true);
  box = new THREE.Box3().setFromObject(template);
  const alignedCenter = box.getCenter(new THREE.Vector3());
  content.position.sub(alignedCenter);
  template.updateMatrixWorld(true);
  const alignedSize = new THREE.Box3().setFromObject(template).getSize(new THREE.Vector3());
  template.scale.setScalar(1.55 / Math.max(alignedSize.x, alignedSize.z));
  template.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
  });
  return template;
}

function analyzePanelShading(slotIndexes, roofSlots, propertyModel) {
  const raycaster = new THREE.Raycaster();
  const panels = slotIndexes.map((slotIndex) => {
    const slot = roofSlots[slotIndex];
    if (!slot) return null;
    const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(slot.quaternion).normalize();
    const origin = slot.position.clone().addScaledVector(normal, .2);
    let openSamples = 0;
    SUN_DIRECTIONS.forEach((sunDirection) => {
      raycaster.set(origin, sunDirection);
      raycaster.near = .08;
      raycaster.far = 35;
      const blocked = raycaster.intersectObject(propertyModel, true).some((intersection) => intersection.distance > .08);
      if (!blocked) openSamples += 1;
    });
    return { slotIndex, solarAccess: Math.round((openSamples / SUN_DIRECTIONS.length) * 100) };
  }).filter(Boolean);
  const solarAccess = panels.length
    ? Math.round(panels.reduce((total, panel) => total + panel.solarAccess, 0) / panels.length)
    : 100;
  return {
    panels,
    solarAccess,
    shadingLoss: 100 - solarAccess,
    affectedPanels: panels.filter((panel) => panel.solarAccess < 86).length,
    criticalPanels: panels.filter((panel) => panel.solarAccess < 58).length,
  };
}

function prioritizeRoofSlots(roofSlots, propertyModel, clusterBestSide = false) {
  const evaluated = analyzePanelShading(roofSlots.map((_, index) => index), roofSlots, propertyModel);
  const accessBySlot = new Map(evaluated.panels.map((panel) => [panel.slotIndex, panel.solarAccess]));
  const centerX = roofSlots.length
    ? roofSlots.reduce((total, slot) => total + slot.position.x, 0) / roofSlots.length
    : 0;
  const sideAverage = (side) => {
    const indexes = roofSlots
      .map((slot, index) => ({ slot, index }))
      .filter(({ slot }) => side < 0 ? slot.position.x < centerX : slot.position.x >= centerX);
    if (!indexes.length) return 0;
    return indexes.reduce((total, { index }) => total + (accessBySlot.get(index) ?? 100), 0) / indexes.length;
  };
  const preferredSide = sideAverage(1) >= sideAverage(-1) ? 1 : -1;

  return roofSlots
    .map((slot, index) => ({ ...slot, solarAccess: accessBySlot.get(index) ?? 100 }))
    .sort((first, second) => {
      if (clusterBestSide) {
        const firstPreferred = preferredSide < 0 ? first.position.x < centerX : first.position.x >= centerX;
        const secondPreferred = preferredSide < 0 ? second.position.x < centerX : second.position.x >= centerX;
        if (firstPreferred !== secondPreferred) return firstPreferred ? -1 : 1;
      }
      if (second.solarAccess !== first.solarAccess) return second.solarAccess - first.solarAccess;
      return Math.abs(first.position.z) - Math.abs(second.position.z);
    });
}

function applyShadingTint(panel, solarAccess) {
  const targetColor = new THREE.Color(solarAccess < 58 ? 0xef4444 : 0xf59e0b);
  const intensity = solarAccess < 58 ? .48 : .28;
  const shouldTint = solarAccess < 86;
  panel.traverse((child) => {
    if (!child.isMesh) return;
    const tintMaterial = (material) => {
      const tinted = material.clone();
      tinted.userData.isShadingClone = true;
      if (shouldTint && tinted.color) tinted.color.lerp(targetColor, intensity);
      if (shouldTint && tinted.emissive) {
        tinted.emissive.copy(targetColor);
        tinted.emissiveIntensity = solarAccess < 58 ? .13 : .07;
      }
      return tinted;
    };
    child.material = Array.isArray(child.material)
      ? child.material.map(tintMaterial)
      : tintMaterial(child.material);
  });
}

function getRoofSurfaces(model) {
  const surfaces = [];
  model.traverse((child) => {
    if (child.isMesh && /roof|telh|cobert/i.test(child.name)) surfaces.push(child);
  });
  return surfaces;
}

function getObjectListBounds(objects) {
  return objects.reduce((bounds, object) => bounds.union(new THREE.Box3().setFromObject(object)), new THREE.Box3());
}

function buildRoofSlots(model) {
  model.updateMatrixWorld(true);
  const roofSurfaces = getRoofSurfaces(model);
  const targets = roofSurfaces.length ? roofSurfaces : [model];
  const bounds = roofSurfaces.length ? getObjectListBounds(roofSurfaces) : new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const raycaster = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const slots = [];
  const minimumHeight = roofSurfaces.length ? bounds.min.y - .15 : bounds.min.y + size.y * .45;

  Array.from({ length: 8 }, (_, row) => row).forEach((row) => {
    Array.from({ length: 6 }, (_, column) => column).forEach((column) => {
      const x = THREE.MathUtils.lerp(bounds.min.x + size.x * .08, bounds.max.x - size.x * .08, column / 5);
      const z = THREE.MathUtils.lerp(bounds.min.z + size.z * .08, bounds.max.z - size.z * .08, row / 7);
      raycaster.set(new THREE.Vector3(x, bounds.max.y + 5, z), down);
      const hit = raycaster.intersectObjects(targets, true).find((intersection) => {
        if (!intersection.face || intersection.point.y < minimumHeight) return false;
        const normal = intersection.face.normal.clone().transformDirection(intersection.object.matrixWorld);
        return normal.y > .35;
      });
      if (!hit) return;
      const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
      const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      slots.push({ position: hit.point.clone().addScaledVector(normal, .11), quaternion });
    });
  });
  return slots.slice(0, MAX_VISUAL_SLOTS);
}

function prepareGlbPropertyModel(model, { removeBackdrop = false, scaleFromRoof = false } = {}) {
  if (removeBackdrop) {
    const backdropMeshes = [];
    model.traverse((child) => { if (child.name === "Plane006_1") backdropMeshes.push(child); });
    backdropMeshes.forEach((child) => child.parent?.remove(child));
  }
  model.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
  });
  model.updateMatrixWorld(true);
  const roofSurfaces = getRoofSurfaces(model);
  const referenceBounds = scaleFromRoof && roofSurfaces.length
    ? getObjectListBounds(roofSurfaces)
    : new THREE.Box3().setFromObject(model);
  const referenceSize = referenceBounds.getSize(new THREE.Vector3());
  model.scale.setScalar((scaleFromRoof ? 13.5 : 14) / Math.max(referenceSize.x, referenceSize.z));
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model);
  const center = bounds.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -bounds.min.y, -center.z);
  model.updateMatrixWorld(true);
  return model;
}

function framePropertyModel(model, camera, controls) {
  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const horizontalSpan = Math.max(size.x, size.z);
  camera.position.set(horizontalSpan * 1.05, Math.max(10.5, size.y * 1.25), horizontalSpan * 1.5);
  controls.target.set(0, size.y * .42, 0);
  controls.minDistance = Math.max(11, horizontalSpan * .8);
  controls.maxDistance = Math.max(36, horizontalSpan * 3);
  controls.update();
  return { bounds, size };
}

function prepareBuildingModel(building) {
  const chimneys = [];
  building.traverse((child) => {
    if (/chimney|chamin[eé]/i.test(child.name)) chimneys.push(child);
  });
  chimneys.forEach((chimney) => chimney.parent?.remove(chimney));

  const materialPalette = new Map();
  const materialSettings = {
    metal_grey: { color: 0x555d68, roughness: .62, metalness: .34 },
    curb: { color: 0x9ca3ad, roughness: .96, metalness: 0 },
    foundation_grey_brick: { color: 0x777d84, roughness: 1, metalness: 0 },
    plaster_grey: { color: 0xb6bbc1, roughness: .94, metalness: 0 },
    plaster_white: { color: 0xe7e4dc, roughness: .9, metalness: 0 },
    plate_white: { color: 0xd6d9dc, roughness: .76, metalness: .04 },
    parapet: { color: 0x565c63, roughness: .72, metalness: .15 },
    wood_balls_brown: { color: 0x704a34, roughness: .88, metalness: 0 },
    wood_brown: { color: 0x6f3f2f, roughness: .86, metalness: 0 },
    window_glass: { color: 0x4f87ad, roughness: .2, metalness: .12 },
  };
  const getMaterial = (name = "plaster_white") => {
    if (!materialPalette.has(name)) {
      materialPalette.set(name, new THREE.MeshStandardMaterial(materialSettings[name] || materialSettings.plaster_white));
    }
    return materialPalette.get(name);
  };

  building.traverse((child) => {
    if (!child.isMesh) return;
    child.material = Array.isArray(child.material)
      ? child.material.map((material) => getMaterial(material.name))
      : getMaterial(child.material?.name);
    child.castShadow = true;
    child.receiveShadow = true;
  });

  let bounds = new THREE.Box3().setFromObject(building);
  const size = bounds.getSize(new THREE.Vector3());
  building.scale.setScalar(14 / Math.max(size.x, size.z));
  building.updateMatrixWorld(true);
  bounds = new THREE.Box3().setFromObject(building);
  const center = bounds.getCenter(new THREE.Vector3());
  building.position.set(-center.x, -bounds.min.y, -center.z);
  building.updateMatrixWorld(true);
  return building;
}

function RoofDesigner({ propertyType, selectedSlots, onToggleSlot, onSlotCount, onShadowAnalysis, showShading }) {
  const canvasRef = useRef(null);
  const selectedRef = useRef(selectedSlots);
  const toggleRef = useRef(onToggleSlot);
  const shadowAnalysisRef = useRef(onShadowAnalysis);
  const showShadingRef = useRef(showShading);
  const syncPanelsRef = useRef(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => { selectedRef.current = selectedSlots; syncPanelsRef.current?.(); }, [selectedSlots]);
  useEffect(() => { toggleRef.current = onToggleSlot; }, [onToggleSlot]);
  useEffect(() => { shadowAnalysisRef.current = onShadowAnalysis; }, [onShadowAnalysis]);
  useEffect(() => { showShadingRef.current = showShading; syncPanelsRef.current?.(); }, [showShading]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, .1, 100);
    camera.position.set(15.5, 10.5, 18.5);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = .07;
    controls.enablePan = false;
    controls.minDistance = 12;
    controls.maxDistance = 34;
    controls.minPolarAngle = .28;
    controls.maxPolarAngle = Math.PI / 2.03;
    controls.target.set(0, 3.1, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xb9c4d7, 2.1));
    const sunlight = new THREE.DirectionalLight(0xffffff, 3.2);
    sunlight.position.set(-7, 15, 10);
    sunlight.castShadow = true;
    sunlight.shadow.mapSize.set(1536, 1536);
    sunlight.shadow.camera.left = -15;
    sunlight.shadow.camera.right = 15;
    sunlight.shadow.camera.top = 15;
    sunlight.shadow.camera.bottom = -15;
    scene.add(sunlight);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(15, 64), new THREE.MeshStandardMaterial({ color: 0xe6ebf3, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -.035;
    ground.receiveShadow = true;
    scene.add(ground);

    const usesBuildingModel = propertyType === "sobrado";
    let propertyModel = null;
    let roofHitTargets = [];
    let roofMinHeight = 3.4;
    let panelTemplate = null;
    let roofSlots = [];
    let disposed = false;
    const panelRoot = new THREE.Group();
    scene.add(panelRoot);

    const syncPanels = () => {
      panelRoot.traverse((child) => {
        if (!child.isMesh) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => material?.userData?.isShadingClone && material.dispose());
      });
      panelRoot.clear();
      if (!panelTemplate || !roofSlots.length || !propertyModel) return;
      const shading = analyzePanelShading(selectedRef.current, roofSlots, propertyModel);
      const accessBySlot = new Map(shading.panels.map((panel) => [panel.slotIndex, panel.solarAccess]));
      selectedRef.current.forEach((slotIndex) => {
        const slot = roofSlots[slotIndex];
        if (!slot) return;
        const panel = panelTemplate.clone(true);
        applyShadingTint(panel, showShadingRef.current ? accessBySlot.get(slotIndex) ?? 100 : 100);
        panel.position.copy(slot.position);
        panel.quaternion.copy(slot.quaternion);
        panel.rotateY(Math.PI / 2);
        panelRoot.add(panel);
      });
      shadowAnalysisRef.current?.(shading);
    };
    syncPanelsRef.current = syncPanels;

    const propertyAssets = usesBuildingModel
      ? new OBJLoader().loadAsync("/models/building/building.obj").then((model) => ({ model }))
      : new GLTFLoader()
        .loadAsync(propertyType === "comercial" ? "/models/residences/semi-residential.glb" : "/models/residences/house.glb")
        .then((gltf) => ({ model: gltf.scene }));

    Promise.all([propertyAssets, new GLTFLoader().loadAsync("/models/solar-panels.glb")]).then(([assets, panelGltf]) => {
      if (disposed) return;
      const { model } = assets;
      if (usesBuildingModel) {
        prepareBuildingModel(model);
      } else {
        prepareGlbPropertyModel(model, { removeBackdrop: propertyType === "terrea", scaleFromRoof: propertyType === "terrea" });
      }
      scene.add(model);
      propertyModel = model;
      const framedModel = framePropertyModel(model, camera, controls);
      roofHitTargets = getRoofSurfaces(model);
      if (!roofHitTargets.length) roofHitTargets = [model];
      const roofBounds = getObjectListBounds(roofHitTargets);
      roofMinHeight = getRoofSurfaces(model).length ? roofBounds.min.y - .15 : framedModel.bounds.min.y + framedModel.size.y * .45;
      panelTemplate = normalizePanelModel(panelGltf.scene);
      roofSlots = prioritizeRoofSlots(buildRoofSlots(model), model, propertyType === "comercial");
      onSlotCount(roofSlots.length);
      syncPanels();
      setStatus("ready");
    }).catch(() => { if (!disposed) setStatus("error"); });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerStart = null;
    const pointerDown = (event) => { pointerStart = { x: event.clientX, y: event.clientY }; };
    const pointerUp = (event) => {
      if (!pointerStart || !propertyModel || !roofSlots.length) return;
      const moved = Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y);
      pointerStart = null;
      if (moved > 6) return;
      const rect = canvas.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(roofHitTargets, true).find((intersection) => intersection.point.y > roofMinHeight);
      if (!hit) return;
      let nearest = -1;
      let nearestDistance = Infinity;
      roofSlots.forEach((slot, index) => {
        const distance = slot.position.distanceToSquared(hit.point);
        if (distance < nearestDistance) { nearestDistance = distance; nearest = index; }
      });
      if (nearest >= 0 && nearestDistance < 5.2) toggleRef.current(nearest);
    };
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("pointerup", pointerUp);

    const resize = () => {
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
    resize();
    const stopRendering = startVisibleRenderLoop(canvas, () => {
      controls.update();
      renderer.render(scene, camera);
    });

    return () => {
      disposed = true;
      stopRendering();
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointerup", pointerUp);
      controls.dispose();
      renderer.dispose();
      syncPanelsRef.current = null;
    };
  }, [onSlotCount, propertyType]);

  return <div className={`roof-stage is-${status}`}>
    <canvas ref={canvasRef} aria-label="Modelo 3D do imóvel com painéis solares"/>
    {status === "loading" && <div className="roof-loading"><i/><span>Preparando seu imóvel em 3D</span></div>}
    {status === "error" && <div className="roof-error"><strong>Não foi possível carregar o modelo 3D.</strong><span>Atualize a página para tentar novamente.</span></div>}
  </div>;
}

function ModelAttribution({ propertyType }) {
  if (propertyType === "sobrado") return null;
  const credit = propertyType === "comercial"
    ? { title: "Casa Tipo Semi Residencial", model: "https://sketchfab.com/3d-models/casa-tipo-semi-residencial-4431db9690aa4d6ea23f50b8fdfa0cd3", author: "alecsvaldez", profile: "https://sketchfab.com/alexvzzz" }
    : { title: "Casa", model: "https://sketchfab.com/3d-models/casa-0bbaefdc37f74ea18f69ccaea1b7d08c", author: "Julien Hondaa", profile: "https://sketchfab.com/julien_hondaa" };
  return <p className="model-attribution">Modelo <a href={credit.model} target="_blank" rel="nofollow noreferrer">{credit.title}</a>, por <a href={credit.profile} target="_blank" rel="nofollow noreferrer">{credit.author}</a> · CC BY 4.0</p>;
}

function ShadowAnalysisCard({ analysis, panelCount }) {
  const data = analysis || { solarAccess: 100, shadingLoss: 0, affectedPanels: 0, criticalPanels: 0 };
  const severity = data.shadingLoss >= 35 ? "is-high" : data.shadingLoss >= 15 ? "is-medium" : "is-low";
  return <aside className={`shadow-analysis-card ${severity}`} aria-live="polite">
    <header><span><ShadowIcon/> Sombreamento</span><strong>{data.shadingLoss}% de perda</strong></header>
    <div className="shadow-access-bar" aria-label={`${data.solarAccess}% de acesso solar`}><i style={{ width: `${data.solarAccess}%` }}/></div>
    <div className="shadow-analysis-metrics">
      <span><small>Acesso solar</small><strong>{data.solarAccess}%</strong></span>
      <span><small>Painéis afetados</small><strong>{data.affectedPanels} de {panelCount}</strong></span>
    </div>
    {data.criticalPanels > 0 && <p>{data.criticalPanels} {data.criticalPanels === 1 ? "painel exige" : "painéis exigem"} reposicionamento.</p>}
    <footer>Prévia geométrica · trajetória solar entre 8h e 16h</footer>
  </aside>;
}

export default function SolarConfigurator({ onSimulationChange, onRequestAnalysis, onInvalidateAnalysis, analysisVisible = false, vehicle = null, onRemoveVehicle, onStart }) {
  const [propertyType, setPropertyType] = useState("terrea");
  const [bill, setBill] = useState(600);
  const [availableSlots, setAvailableSlots] = useState(MAX_VISUAL_SLOTS);
  const [shadowAnalysis, setShadowAnalysis] = useState(null);
  const profile = propertyTypes.find((item) => item.id === propertyType) || propertyTypes[0];
  const extraConsumption = vehicle?.monthlyEnergy || 0;
  const monthlyConsumption = useMemo(() => Math.round(bill / ENERGY_TARIFF + extraConsumption), [bill, extraConsumption]);
  const recommendedPanels = useMemo(() => Math.max(4, Math.ceil(monthlyConsumption / (PANEL_POWER_KW * MONTHLY_YIELD_PER_KWP))), [monthlyConsumption]);
  const visualCapacity = Math.min(profile.capacity, availableSlots || MAX_VISUAL_SLOTS);
  const initialCount = Math.min(recommendedPanels, visualCapacity);
  const [selectedSlots, setSelectedSlots] = useState(() => Array.from({ length: initialCount }, (_, index) => index));

  const recommendFor = (nextBill, capacity = visualCapacity) => {
    const consumption = Math.round(nextBill / ENERGY_TARIFF + extraConsumption);
    const panels = Math.max(4, Math.ceil(consumption / (PANEL_POWER_KW * MONTHLY_YIELD_PER_KWP)));
    return Array.from({ length: Math.min(panels, capacity) }, (_, index) => index);
  };
  const [lastVehicle, setLastVehicle] = useState(vehicle);
  if (lastVehicle !== vehicle) {
    setLastVehicle(vehicle);
    setSelectedSlots(recommendFor(bill));
  }
  const started = useRef(false);
  const start = () => { if (!started.current) { started.current = true; onStart?.(); } };
  const selectProperty = (item) => {
    onInvalidateAnalysis?.();
    setPropertyType(item.id);
    setAvailableSlots(MAX_VISUAL_SLOTS);
    setShadowAnalysis(null);
    setSelectedSlots(recommendFor(bill, item.capacity));
  };
  const changeBill = (nextBill) => {
    onInvalidateAnalysis?.();
    setBill(nextBill);
    setSelectedSlots(recommendFor(nextBill));
  };
  const resetSimulation = () => {
    const defaultProfile = propertyTypes[0];
    onInvalidateAnalysis?.();
    setPropertyType(defaultProfile.id);
    setBill(600);
    onRemoveVehicle?.();
    started.current = false;
    setAvailableSlots(MAX_VISUAL_SLOTS);
    setShadowAnalysis(null);
    setSelectedSlots(recommendFor(600, defaultProfile.capacity));
  };
  const handleSlotCount = useCallback((count) => {
    setAvailableSlots(count);
    setSelectedSlots((current) => current.filter((slot) => slot < count));
  }, []);
  const handleShadowAnalysis = useCallback((analysis) => setShadowAnalysis(analysis), []);
  const toggleSlot = (slot) => {
    onInvalidateAnalysis?.();
    setSelectedSlots((current) => current.includes(slot) ? current.filter((item) => item !== slot) : current.length < visualCapacity ? [...current, slot].sort((a, b) => a - b) : current);
  };
  const removePanel = () => {
    onInvalidateAnalysis?.();
    setSelectedSlots((current) => current.slice(0, -1));
  };
  const addPanel = () => {
    onInvalidateAnalysis?.();
    setSelectedSlots((current) => {
    if (current.length >= visualCapacity) return current;
    const next = Array.from({ length: visualCapacity }, (_, index) => index).find((index) => !current.includes(index));
    return next === undefined ? current : [...current, next].sort((a, b) => a - b);
    });
  };
  const installedPower = selectedSlots.length * PANEL_POWER_KW;
  const solarAccess = shadowAnalysis?.solarAccess ?? 100;
  const shadingLoss = shadowAnalysis?.shadingLoss ?? 0;
  const monthlyGeneration = Math.round(installedPower * MONTHLY_YIELD_PER_KWP * (solarAccess / 100));
  const estimatedSavings = Math.round(Math.min(bill + extraConsumption * ENERGY_TARIFF, monthlyGeneration * ENERGY_TARIFF) * .85);
  const panelCount = selectedSlots.length;
  const message = [
    "Olá, Modesto Energias Renováveis! Fiz uma pré-simulação no site.",
    `Tipo de imóvel: ${profile.label}`,
    `Conta média: R$ ${bill.toLocaleString("pt-BR")}`,
    `Consumo estimado: ${monthlyConsumption} kWh/mês`,
    vehicle ? `Recarga incluída: ${vehicle.dailyDistance} km/dia · ${Math.round(extraConsumption)} kWh/mês` : "",
    `Recomendação inicial: ${recommendedPanels} painéis`,
    `Montagem escolhida: ${panelCount} painéis (${installedPower.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWp)`,
    `Acesso solar estimado: ${solarAccess}% (${shadingLoss}% de perdas por sombra)`,
    "Gostaria de confirmar a viabilidade técnica.",
  ].join("\n");

  useEffect(() => {
    onSimulationChange?.({ property: profile.label, propertyType, bill, panels: panelCount, recommendedPanels, installedPower, monthlyGeneration, estimatedSavings, monthlyConsumption, solarAccess, shadingLoss, affectedPanels: shadowAnalysis?.affectedPanels ?? 0, vehicle });
  }, [bill, estimatedSavings, installedPower, monthlyConsumption, monthlyGeneration, onSimulationChange, panelCount, profile.label, propertyType, recommendedPanels, shadingLoss, shadowAnalysis?.affectedPanels, solarAccess, vehicle]);

  return <section className="section solar-configurator-section" onChangeCapture={start} onClickCapture={start}>
    <div className="container configurator-heading">
      <div><span className="kicker">MONTE SUA PRÉ-SIMULAÇÃO</span><h2>Descubra o potencial de economia <em>do seu imóvel.</em></h2></div>
      <p>Escolha o imóvel, informe sua conta e monte os painéis. Depois, veja a análise de geração e solicite a avaliação da nossa equipe.</p>
    </div>
    <div className="container solar-configurator">
      <div className="config-panel">
        <div className="config-panel__meta">
          <span>PROJETO RESIDENCIAL</span>
          <small>PRÉ-DIMENSIONAMENTO · 3 ETAPAS</small>
        </div>
        <div className="config-step">
          <div className="config-step__title"><span>01</span><div><strong>Como é seu imóvel?</strong><small>Escolha o perfil mais parecido.</small></div></div>
          <div className="property-tab-container">
            <div className="property-tabs" role="radiogroup" aria-label="Tipo de imóvel">
              {propertyTypes.map((item) => <label className="property-tab" htmlFor={`property-${item.id}`} key={item.id}><input type="radio" id={`property-${item.id}`} name="property-type" value={item.id} checked={propertyType === item.id} onChange={() => selectProperty(item)}/><PropertyIcon name={item.icon}/><span>{item.label}</span></label>)}
              <span className={`property-glider property-glider--${propertyType}`} aria-hidden="true"/>
            </div>
            <small className="property-tab-detail" aria-live="polite">{profile.detail}</small>
          </div>
        </div>
        <div className="config-step bill-step">
          <div className="config-step__title"><span>02</span><div><strong>Qual a média da conta?</strong><small>Use o valor mensal aproximado.</small></div></div>
          <div className="config-bill"><span>R$</span><strong>{bill.toLocaleString("pt-BR")}</strong><small>/mês</small></div>
          <EstimateRange id="solar-average-bill" min={200} max={3000} step={50} value={bill} onChange={(event) => changeBill(Number(event.target.value))} minLabel="R$ 200" maxLabel="R$ 3.000+" ariaLabel="Valor médio da conta de energia"/>
        </div>
        {vehicle&&<div className="included-vehicle" role="status"><strong>Recarga incluída no projeto</strong><span>+{Math.round(extraConsumption)} kWh/mês · {vehicle.dailyDistance} km/dia</span><small>A conta acima deve representar o imóvel sem a recarga, para não contar o carro duas vezes.</small><button type="button" onClick={onRemoveVehicle}>Remover recarga</button></div>}
        <div className="config-step assembly-step">
          <div className="config-step__title"><span>03</span><div><strong>Monte sua cobertura</strong><small>Clique no telhado ou use os controles.</small></div></div>
          <div className="panel-stepper"><button type="button" onClick={removePanel} disabled={!selectedSlots.length} aria-label="Remover um painel">−</button><div><strong>{selectedSlots.length}</strong><small>painéis selecionados</small></div><button type="button" onClick={addPanel} disabled={selectedSlots.length >= visualCapacity} aria-label="Adicionar um painel">+</button></div>
          <button className="recommended-button" type="button" onClick={() => { onInvalidateAnalysis?.(); setSelectedSlots(Array.from({ length: Math.min(recommendedPanels, visualCapacity) }, (_, index) => index)); }}>Usar recomendação de {recommendedPanels} painéis</button>
          {recommendedPanels > visualCapacity && <p className="capacity-note">A demanda indica mais módulos do que este perfil comporta na visualização. A equipe poderá avaliar outras áreas da cobertura.</p>}
        </div>
        <div className="config-result-label"><span>Resultado instantâneo</span><small>Atualizado conforme suas escolhas</small></div>
        <div className="config-summary" aria-live="polite">
          <div><span>Potência montada</span><strong>{installedPower.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWp</strong></div>
          <div><span>Geração estimada</span><strong>{monthlyGeneration.toLocaleString("pt-BR")} kWh/mês</strong></div>
          <div><span>Economia indicativa</span><strong>R$ {estimatedSavings.toLocaleString("pt-BR")}/mês</strong></div>
        </div>
        <div className="config-actions"><button className="config-cta" type="button" onClick={onRequestAnalysis} disabled={!panelCount} aria-expanded={analysisVisible} aria-controls="analise-geracao">Ver análise de geração <ArrowIcon/></button><a className="config-secondary" onClick={()=>trackConversion("whatsapp_clicked","residential")} href={`https://wa.me/5584992315543?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">Enviar pelo WhatsApp</a></div>
        <div className="simulation-repeat-row"><RepeatSimulationButton onClick={resetSimulation}/></div>
        <small className="config-disclaimer">Estimativa preliminar. Quantidade, posicionamento, sombreamento e geração dependem da análise técnica do imóvel.</small>
      </div>
      <div className="roof-viewer-card">
        <div className="viewer-topbar"><span><i/> Visualização interativa</span><small>{profile.label} · {selectedSlots.length} módulos</small></div>
        <RoofDesigner key={propertyType} propertyType={propertyType} selectedSlots={selectedSlots} onToggleSlot={toggleSlot} onSlotCount={handleSlotCount} onShadowAnalysis={handleShadowAnalysis} showShading={analysisVisible}/>
        {analysisVisible&&<ShadowAnalysisCard analysis={shadowAnalysis} panelCount={panelCount}/>} 
        <ModelAttribution propertyType={propertyType}/>
        <div className="viewer-help"><strong>Arraste para girar</strong><span>Clique sobre o telhado para adicionar ou remover módulos.</span></div>
      </div>
    </div>
  </section>;
}

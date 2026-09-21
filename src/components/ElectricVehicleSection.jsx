import { useEffect, useMemo, useRef, useState } from "react";
import "../styles/electric-vehicle.css";
import EstimateRange from "./EstimateRange";
import RepeatSimulationButton from "./RepeatSimulationButton";
import { startVisibleRenderLoop } from "../lib/visible-render-loop";
import { trackConversion } from "../lib/conversion-events";

const PHONE = "5584992315543";
const CHARGING_EFFICIENCY = 0.9;
const ENERGY_TARIFF = 0.95;
const PANEL_POWER_KW = 0.55;
const MONTHLY_YIELD_PER_KWP = 130;
const EV_BATTERY_KWH = 38;
const OFFICIAL_RANGE_KM = 280;
const DRIVER_RESERVE = 0.15;

function EvIcon({ name, size = 20 }) {
  const paths = {
    bolt: <path d="m13 2-8 11h7l-1 9 8-12h-7l1-8Z" />,
    route: <><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h3a4 4 0 0 0 4-4V10a4 4 0 0 1 3-4"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    battery: <><rect x="3" y="6" width="16" height="12" rx="2"/><path d="M19 10h2v4h-2M7 9v6M10 9v6M13 9v6M16 9v6"/></>,
    panel: <><path d="M5 4h14l2 12H3L5 4Z"/><path d="M8 4 7 16m5-12v12m4-12 1 12M4 10h16M9 20h6m-3-4v4"/></>,
    plug: <><path d="M9 7V3m6 4V3M7 7h10v3a5 5 0 0 1-5 5v6M9 21h6"/></>,
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    rotate: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M18.5 9A7 7 0 0 0 6.4 5.6L4 8m16 8-2.4 2.4A7 7 0 0 1 5.5 15"/></>,
    expand: <><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></>,
    collapse: <><path d="M8 8H3V3M16 8h5V3M8 16H3v5M16 16h5v5"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

const formatEnergy = value => value.toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const formatMoney = value => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const formatDuration = value => {
  const hours = Math.floor(value);
  const minutes = Math.round((value - hours) * 60);
  if (!hours) return `${Math.max(1, minutes)} min`;
  if (!minutes) return `${hours} h`;
  return `${hours} h ${minutes} min`;
};

function VehicleChargingScene() {
  const mountRef = useRef(null);
  const [sceneState, setSceneState] = useState("loading");

  useEffect(() => {
    let active = true;
    let destroy = () => {};

    const initialize = async () => {
      try {
        const [THREE, { GLTFLoader }, { OrbitControls }] = await Promise.all([
          import("three"),
          import("three/examples/jsm/loaders/GLTFLoader.js"),
          import("three/examples/jsm/controls/OrbitControls.js"),
        ]);
        const mount = mountRef.current;
        if (!active || !mount) return;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xeef2f8);
        scene.fog = new THREE.Fog(0xeef2f8, 11, 24);

        const camera = new THREE.PerspectiveCamera(34, 1, 0.08, 80);
        camera.position.set(7, 3.45, 7.4);

        const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
        renderer.domElement.className = "ev-three-canvas";
        mount.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.06;
        controls.enablePan = false;
        controls.minDistance = 6.3;
        controls.maxDistance = 10.8;
        controls.minPolarAngle = Math.PI * 0.2;
        controls.maxPolarAngle = Math.PI * 0.47;
        controls.target.set(0.9, 0.75, 0);

        scene.add(new THREE.HemisphereLight(0xffffff, 0x64708d, 2.5));
        const keyLight = new THREE.DirectionalLight(0xffffff, 4.2);
        keyLight.position.set(5, 8, 5);
        keyLight.castShadow = true;
        const shadowSize = window.matchMedia("(max-width: 700px)").matches ? 1024 : 2048;
        keyLight.shadow.mapSize.set(shadowSize, shadowSize);
        keyLight.shadow.camera.left = -7;
        keyLight.shadow.camera.right = 7;
        keyLight.shadow.camera.top = 7;
        keyLight.shadow.camera.bottom = -7;
        scene.add(keyLight);
        const rimLight = new THREE.DirectionalLight(0x7aa9ff, 2.2);
        rimLight.position.set(-6, 3, -5);
        scene.add(rimLight);

        const platform = new THREE.Mesh(
          new THREE.CircleGeometry(7.5, 96),
          new THREE.MeshStandardMaterial({ color: 0xf9fbff, roughness: 0.92, metalness: 0.02 }),
        );
        platform.rotation.x = -Math.PI / 2;
        platform.receiveShadow = true;
        scene.add(platform);

        const rings = new THREE.Group();
        [2.75, 4.4, 6.1].forEach(radius => {
          const ring = new THREE.Mesh(
            new THREE.RingGeometry(radius, radius + 0.012, 96),
            new THREE.MeshBasicMaterial({ color: 0x1717b8, transparent: true, opacity: 0.08, side: THREE.DoubleSide }),
          );
          ring.rotation.x = -Math.PI / 2;
          ring.position.y = 0.006;
          rings.add(ring);
        });
        scene.add(rings);

        const normalizeModel = (model, targetSize, axis) => {
          model.updateMatrixWorld(true);
          let bounds = new THREE.Box3().setFromObject(model);
          const size = bounds.getSize(new THREE.Vector3());
          const scale = targetSize / size[axis];
          model.scale.setScalar(scale);
          model.updateMatrixWorld(true);
          bounds = new THREE.Box3().setFromObject(model);
          const center = bounds.getCenter(new THREE.Vector3());
          model.position.x -= center.x;
          model.position.z -= center.z;
          model.position.y -= bounds.min.y;
          model.updateMatrixWorld(true);
        };

        const loader = new GLTFLoader();
        const loadModel = url => new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
        const [carGltf, wallboxGltf] = await Promise.all([
          loadModel("/models/vehicles/2024_byd_seagull.glb"),
          loadModel("/models/vehicles/wallbox.glb"),
        ]);
        if (!active) return;

        const car = carGltf.scene;
        normalizeModel(car, 3.82, "z");
        car.rotation.y = -0.08;
        car.position.set(-0.35, 0.03, 0.28);
        car.traverse(child => {
          if (!child.isMesh) return;
          child.castShadow = true;
          child.receiveShadow = true;
          child.material?.map && (child.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy());
        });
        scene.add(car);

        const wallbox = wallboxGltf.scene;
        normalizeModel(wallbox, 3.6, "y");
        wallbox.rotation.y = -0.32;
        wallbox.position.set(1.78, 0.04, -1.34);
        wallbox.traverse(child => {
          if (!child.isMesh) return;
          child.castShadow = true;
          child.receiveShadow = true;
          child.material?.map && (child.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy());
        });
        scene.add(wallbox);

        const resize = () => {
          if (!mount.clientWidth || !mount.clientHeight) return;
          renderer.setSize(mount.clientWidth, mount.clientHeight, false);
          camera.aspect = mount.clientWidth / mount.clientHeight;
          camera.updateProjectionMatrix();
        };
        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(mount);
        resize();
        const stopRendering = startVisibleRenderLoop(renderer.domElement, () => {
          controls.update();
          renderer.render(scene, camera);
        });
        setSceneState("ready");

        destroy = () => {
          resizeObserver.disconnect();
          stopRendering();
          controls.dispose();
          scene.traverse(object => {
            object.geometry?.dispose?.();
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            materials.filter(Boolean).forEach(material => {
              Object.values(material).forEach(value => value?.isTexture && value.dispose());
              material.dispose?.();
            });
          });
          renderer.dispose();
          renderer.domElement.remove();
        };
      } catch (error) {
        console.error("Não foi possível carregar a cena do carro elétrico.", error);
        if (active) setSceneState("error");
      }
    };

    initialize();
    return () => {
      active = false;
      destroy();
    };
  }, []);

  return <div ref={mountRef} className="ev-three-stage" aria-label="Cena 3D interativa com carro elétrico conectado ao wallbox">
    {sceneState === "loading" && <span className="ev-model-loader"><i/> Preparando carro e wallbox...</span>}
    {sceneState === "error" && <span className="ev-model-loader is-error">Não foi possível carregar os modelos 3D.</span>}
  </div>;
}

export default function ElectricVehicleSection({ onInclude, onEstimateChange, onReset }) {
  const [usageProfile, setUsageProfile] = useState("personal");
  const [dailyDistance, setDailyDistance] = useState(40);
  const [workingDays, setWorkingDays] = useState(30);
  const [consumption, setConsumption] = useState(16);
  const [chargerPower, setChargerPower] = useState(7.4);
  const [connected, setConnected] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [modelActive, setModelActive] = useState(false);
  const workspaceRef = useRef(null);

  useEffect(() => {
    const updateFullscreen = () => setFullscreen(document.fullscreenElement === workspaceRef.current);
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () => document.removeEventListener("fullscreenchange", updateFullscreen);
  }, []);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await workspaceRef.current?.requestFullscreen?.();
  };

  const selectUsageProfile = profile => {
    setUsageProfile(profile);
    if (profile === "driver") {
      setDailyDistance(200);
      setWorkingDays(26);
    } else {
      setDailyDistance(40);
      setWorkingDays(30);
    }
  };

  const resetSimulation = () => {
    onReset?.();
    setUsageProfile("personal");
    setDailyDistance(40);
    setWorkingDays(30);
    setConsumption(16);
    setChargerPower(7.4);
    setConnected(true);
  };

  const distanceMax = usageProfile === "driver" ? 350 : 200;

  const analysis = useMemo(() => {
    const vehicleDailyEnergy = dailyDistance * (consumption / 100);
    const dailyEnergy = vehicleDailyEnergy / CHARGING_EFFICIENCY;
    const monthlyEnergy = dailyEnergy * workingDays;
    const chargeTime = dailyEnergy / chargerPower;
    const panels = Math.max(1, Math.ceil(monthlyEnergy / (PANEL_POWER_KW * MONTHLY_YIELD_PER_KWP)));
    const planningRange = (EV_BATTERY_KWH * (1 - DRIVER_RESERVE) / consumption) * 100;
    return {
      dailyEnergy,
      monthlyEnergy,
      chargeTime,
      panels,
      monthlyCost: monthlyEnergy * ENERGY_TARIFF,
      planningRange,
      dailyBatteryUse: (vehicleDailyEnergy / EV_BATTERY_KWH) * 100,
      chargesPerDay: Math.max(1, Math.ceil(dailyDistance / planningRange)),
    };
  }, [chargerPower, consumption, dailyDistance, workingDays]);

  useEffect(()=>{
    onEstimateChange?.({usageProfile,dailyDistance,workingDays,consumption,chargerPower,...analysis});
  },[analysis,chargerPower,consumption,dailyDistance,onEstimateChange,usageProfile,workingDays]);

  const whatsappMessage = [
    "Olá, Modesto Energias Renováveis! Gostaria de incluir a recarga do meu carro elétrico no projeto solar.",
    `Perfil de uso: ${usageProfile === "driver" ? "Motorista de aplicativo" : "Uso particular"}`,
    `Percurso diário: ${dailyDistance} km`,
    `Dias de uso no mês: ${workingDays}`,
    `Consumo estimado: ${consumption} kWh/100 km`,
    `Wallbox considerado: ${chargerPower.toLocaleString("pt-BR")} kW`,
    `Energia adicional estimada: ${formatEnergy(analysis.monthlyEnergy)} kWh/mês`,
    `Estimativa inicial: ${analysis.panels} painéis adicionais`,
    usageProfile === "driver" ? `Autonomia de planejamento com 15% de reserva: ${Math.round(analysis.planningRange)} km` : "",
  ].filter(Boolean).join("\n");

  return <section className="section ev-section">
    <div className="container">
      <div className="ev-heading">
        <div>
          <span className="kicker">MOBILIDADE ELÉTRICA</span>
          <h2>Planeje a recarga do carro <br/><em>junto com a sua geração.</em></h2>
        </div>
        <p>Informe sua rotina e veja quanto a recarga pode acrescentar ao consumo. Inclua essa demanda no sistema solar com um clique, seja para uso particular ou trabalho por aplicativo.</p>
      </div>

      <div className="ev-workspace" ref={workspaceRef}>
        <article className={`ev-model-card ${connected ? "is-connected" : ""}`}>
          <div className="ev-model-topline">
            <span><i/> Carro elétrico + wallbox</span>
            <div className="ev-model-actions">
              <button type="button" onClick={() => setConnected(value => !value)} aria-pressed={connected}>
                <span className="ev-power-symbol"><EvIcon name="bolt" size={16}/></span>
                {connected ? "Conectado" : "Conectar"}
              </button>
              <button className="ev-fullscreen-button" type="button" onClick={toggleFullscreen} aria-label={fullscreen ? "Sair da tela cheia" : "Abrir visualização em tela cheia"} title={fullscreen ? "Sair da tela cheia" : "Tela cheia"}>
                <EvIcon name={fullscreen ? "collapse" : "expand"} size={18}/>
              </button>
            </div>
          </div>
          <div className="ev-model-stage">
            {modelActive?<VehicleChargingScene/>:<div className="ev-model-cover"><EvIcon name="plug" size={64}/><strong>Explore o carro e o wallbox em 3D</strong><p>A simulação de recarga já está disponível nos controles.</p><button className="btn btn-small" type="button" onClick={()=>setModelActive(true)}>Abrir visualização 3D</button></div>}
            <span className="ev-model-hint"><EvIcon name="rotate" size={15}/> Arraste para explorar · use a roda para aproximar</span>
          </div>
          <footer className="ev-model-footer">
            <span><small>Status</small><strong>{connected ? "Pronto para recarga" : "Aguardando conexão"}</strong></span>
            <span><small>Visualização</small><strong>Modelo interativo 3D</strong></span>
          </footer>
        </article>

        <article className="ev-calculator-card">
          <div className="ev-calculator-meta">
            <span>PLANEJAMENTO DE RECARGA</span>
            <small>SIMULAÇÃO INTERATIVA · EV</small>
          </div>
          <div className="ev-calculator-title">
            <span><EvIcon name="bolt" size={19}/></span>
            <div><small>ESTIMATIVA PERSONALIZADA</small><h3>Recarga diária</h3></div>
          </div>

          <div className="ev-profile-tabs" role="radiogroup" aria-label="Perfil de utilização do carro elétrico">
            <label className="ev-profile-tab" htmlFor="ev-profile-personal"><input id="ev-profile-personal" type="radio" name="ev-usage-profile" value="personal" checked={usageProfile === "personal"} onChange={() => selectUsageProfile("personal")}/><span>Uso particular</span></label>
            <label className="ev-profile-tab" htmlFor="ev-profile-driver"><input id="ev-profile-driver" type="radio" name="ev-usage-profile" value="driver" checked={usageProfile === "driver"} onChange={() => selectUsageProfile("driver")}/><span>Motorista de aplicativo</span></label>
            <span className={`ev-profile-glider ev-profile-glider--${usageProfile}`} aria-hidden="true"/>
          </div>

          {usageProfile === "driver" && <div className="ev-driver-reference">
            <div className="ev-driver-reference__header"><span>Referência para trabalho diário</span><a href="https://www.byd.com/content/dam/byd-site/br/fichas-t%C3%A9cnicas-2026/356.1575.7802.4%20-%20FICHA%20TECNICA%20DOLPHIN%20MINI_v4.pdf" target="_blank" rel="noreferrer">Ficha BYD/Inmetro</a></div>
            <div className="ev-driver-reference__metrics">
              <span><small>Autonomia oficial</small><strong>{OFFICIAL_RANGE_KM} km</strong></span>
              <span><small>Bateria</small><strong>{EV_BATTERY_KWH} kWh</strong></span>
              <span><small>Planejamento com reserva</small><strong>{Math.round(analysis.planningRange)} km</strong></span>
            </div>
            <p className={dailyDistance > analysis.planningRange ? "is-warning" : ""}>{dailyDistance > analysis.planningRange ? `O percurso ultrapassa a autonomia de planejamento. Considere ${analysis.chargesPerDay - 1} recarga complementar durante o turno.` : "O percurso informado cabe em uma carga, mantendo aproximadamente 15% de reserva."}</p>
          </div>}

          <label className="ev-range-label" htmlFor="ev-daily-distance">
            <span>Quanto você dirige por dia?</span>
            <strong>{dailyDistance} <small>km</small></strong>
          </label>
          <EstimateRange id="ev-daily-distance" min={10} max={distanceMax} step={5} value={dailyDistance} onChange={event => setDailyDistance(Number(event.target.value))} minLabel="10 km" maxLabel={`${distanceMax} km`} ariaLabel="Quilometragem dirigida por dia"/>

          {usageProfile === "driver" && <div className="ev-working-days">
            <label htmlFor="ev-working-days"><span>Dias trabalhados no mês</span><strong>{workingDays} dias</strong></label>
            <EstimateRange id="ev-working-days" min={10} max={31} step={1} value={workingDays} onChange={event => setWorkingDays(Number(event.target.value))} minLabel="10 dias" maxLabel="31 dias" ariaLabel="Quantidade de dias trabalhados no mês"/>
          </div>}

          <div className="ev-fields">
            <label>
              <span>Consumo do veículo</span>
              <select value={consumption} onChange={event => setConsumption(Number(event.target.value))}>
                <option value="13">13 kWh/100 km · econômico</option>
                <option value="16">16 kWh/100 km · médio</option>
                <option value="20">20 kWh/100 km · SUV</option>
                <option value="24">24 kWh/100 km · alto consumo</option>
              </select>
            </label>
            <label>
              <span>Potência do wallbox</span>
              <select value={chargerPower} onChange={event => setChargerPower(Number(event.target.value))}>
                <option value="3.7">3,7 kW</option>
                <option value="7.4">7,4 kW</option>
                <option value="11">11 kW</option>
                <option value="22">22 kW</option>
              </select>
            </label>
          </div>

          <div className="ev-results-label"><span>Resultados do cenário</span><small>Atualização automática</small></div>
          <div className="ev-results" aria-live="polite">
            <div><EvIcon name="battery"/><span><small>Energia por dia</small><strong>{formatEnergy(analysis.dailyEnergy)} kWh</strong></span></div>
            <div><EvIcon name="clock"/><span><small>Tempo de recarga</small><strong>{formatDuration(analysis.chargeTime)}</strong></span></div>
            <div><EvIcon name="route"/><span><small>Consumo por mês</small><strong>{formatEnergy(analysis.monthlyEnergy)} kWh</strong></span></div>
            <div><EvIcon name="panel"/><span><small>Compensação estimada</small><strong>{analysis.panels} {analysis.panels === 1 ? "painel" : "painéis"}</strong></span></div>
          </div>

          {usageProfile === "driver" && <div className="ev-driver-operation" aria-live="polite">
            <span><small>Uso diário da bateria</small><strong>{Math.round(analysis.dailyBatteryUse)}%</strong></span>
            <span><small>Recargas necessárias</small><strong>{analysis.chargesPerDay === 1 ? "1 noturna" : `${analysis.chargesPerDay - 1} complementar`}</strong></span>
          </div>}

          <div className="ev-summary">
            <span>Custo mensal sem geração solar <small>Tarifa de referência: R$ 0,95/kWh</small></span>
            <strong>{formatMoney(analysis.monthlyCost)}</strong>
          </div>
          <div className="ev-actions">
            <a className="ev-primary-action" href="#simulador" onClick={()=>{onInclude?.({usageProfile,dailyDistance,workingDays,consumption,chargerPower,...analysis});trackConversion("simulation_completed","vehicle")}}>Incluir no sistema solar <EvIcon name="arrow" size={17}/></a>
            <a className="ev-secondary-action" onClick={()=>trackConversion("whatsapp_clicked","vehicle")} href={`https://wa.me/${PHONE}?text=${encodeURIComponent(whatsappMessage)}`} target="_blank" rel="noreferrer">Enviar estimativa</a>
          </div>
          <div className="simulation-repeat-row"><RepeatSimulationButton onClick={resetSimulation}/></div>
          <p className="ev-disclaimer">Estimativa inicial com 90% de eficiência de recarga e {workingDays} dias de uso por mês. O tempo é teórico e depende também da potência AC aceita pelo veículo. O dimensionamento final considera a instalação elétrica, o padrão de uso e o local.</p>
        </article>
      </div>

      <p className="ev-model-credit">Modelos 3D: “2024 BYD Seagull”, por <a href="https://sketchfab.com/3d-models/2024-byd-seagull-7ffd92188fcd43429545e5e0b12c416c" target="_blank" rel="noreferrer">Ddiaz Design</a>, sob CC BY-NC-SA 4.0; e “Wandlader voor elektrische auto's”, por <a href="https://sketchfab.com/scb3d" target="_blank" rel="noreferrer">Stichting Consortium Beroepsonderwijs</a>, sob <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>.</p>
    </div>
  </section>;
}

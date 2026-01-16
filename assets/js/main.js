/**
 * Main JavaScript Entry Point
 * Focus: WebGL Setup (Three.js) & Global Interactions
 */

// Configuração Global
const config = {
    imagePath: './assets/images/hero.jpg',
    mouseEase: 0.1, // Suavização do movimento do mouse
    waveIntensity: 0.02, // Intensidade da distorção
    waveSpeed: 2.0 // Velocidade da animação
};

// Estado da Aplicação
const state = {
    mouse: new THREE.Vector2(0.5, 0.5),
    targetMouse: new THREE.Vector2(0.5, 0.5),
    time: 0
};

class WebGLHero {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.cloversFalling = false; // Controle de estado da animação

        this.initScene();
        this.initCamera();
        this.initRenderer();
        this.initObjects();
        this.initClovers(); // Inicializa o sistema de partículas
        this.addListeners();
        this.render();
    }

    initScene() {
        this.scene = new THREE.Scene();
    }

    initCamera() {
        // Configuração da Câmera
        this.camera = new THREE.PerspectiveCamera(70, this.width / this.height, 0.01, 10);
        // LÓGICA DE ZOOM RESPONSIVO
        // Se a tela for estreita (Mobile), afastamos a câmera (Z = 2.2)
        // Se for larga (Desktop), mantemos o padrão (Z = 1)
        if (this.width < 768) {
            this.camera.position.z = 2.2; // Mobile: Bem afastado para ver a cena toda
        } else {
            this.camera.position.z = 1.0; // Desktop: Mantém o original perfeito
        }
    }

    initRenderer() {
        this.renderer = new THREE.WebGLRenderer({ 
            alpha: true, 
            antialias: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Otimização de performance
        this.container.appendChild(this.renderer.domElement);
    }

    initObjects() {
        // Carregamento da Textura
        const loader = new THREE.TextureLoader();
        
        // --- CONFIGURAÇÃO DAS IMAGENS ---
        // Certifique-se que o nome do arquivo da desktop é este mesmo que você já usa
        const imageDesktop = './assets/images/hero.jpg'; 
        // Certifique-se que a extensão da mobile está correta (.jpg, .png, etc)
        const imageMobile = './assets/images/hero-mobile.jpg';

        // --- LÓGICA DE DECISÃO --- 
        // Verifica se a tela é "em pé" (Portrait)
        const isMobile = window.innerWidth < window.innerHeight;

        // Define qual URL usar
        const imageUrl = isMobile ? imageMobile : imageDesktop;
        
        console.log('Modo Mobile (Portrait)?', isMobile); 
        console.log('Carregando imagem:', imageUrl);

        // --- CARREGAMENTO ---
        loader.load(imageUrl, (t) => {
            t.minFilter = THREE.LinearFilter;
            t.magFilter = THREE.LinearFilter;
            
            this.texture = t;
            this.imageResolution = new THREE.Vector2(t.image.width, t.image.height);

            // Força a atualização dos uniforms assim que carrega (caso o mesh já exista)
            if (this.mesh) {
                this.mesh.material.uniforms.uImageResolution.value = this.imageResolution;
                this.mesh.material.uniforms.uTexture.value = t;
            } else {
                this.createPlane(t);
            }
        });
    }

    createPlane(texture) {
        // Geometria que ocupa a tela baseada no FOV e distância da câmera
        const fovY = this.camera.fov * (Math.PI / 180);
        const planeHeight = 2 * Math.tan(fovY / 2) * this.camera.position.z;
        const planeWidth = planeHeight * (this.width / this.height);

        const geometry = new THREE.PlaneGeometry(1, 1, 32, 32);

        // Shader Personalizado
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uTexture: { value: texture },
                uMouse: { value: new THREE.Vector2(0.5, 0.5) },
                uResolution: { value: new THREE.Vector2(this.width, this.height) },
                uImageResolution: { value: new THREE.Vector2(texture.image.width, texture.image.height) }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uTime;
                uniform sampler2D uTexture;
                uniform vec2 uMouse;
                uniform vec2 uResolution;
                uniform vec2 uImageResolution;
                
                varying vec2 vUv;

                void main() {
                    // Cálculo de Aspect Ratio Padrão (Cover)
                    vec2 ratio = vec2(
                        min((uResolution.x / uResolution.y) / (uImageResolution.x / uImageResolution.y), 1.0),
                        min((uResolution.y / uResolution.x) / (uImageResolution.y / uImageResolution.x), 1.0)
                    );
                    // Centralização Padrão (0.5)
                    vec2 uv = vec2(
                        vUv.x * ratio.x + (1.0 - ratio.x) * 0.5,
                        vUv.y * ratio.y + (1.0 - ratio.y) * 0.5
                    );
                    // Distorção Líquida (Original)
                    float dist = distance(vUv, uMouse);
                    float wave = sin(dist * 6.0 - uTime * 0.8);
                    float strength = smoothstep(1.5, 0.0, dist) * 0.015; 
                    
                    vec2 distortedUv = uv + (vec2(wave) * strength);
                    gl_FragColor = texture2D(uTexture, distortedUv);
                }
            `
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.scale.set(planeWidth, planeHeight, 1);
        this.scene.add(this.mesh);
    }

    initClovers() {
        // 1. Configuração do Sistema de Partículas (InstancedMesh)
        const loader = new THREE.TextureLoader();
        const cloverTexture = loader.load('./assets/images/trevo.png');

        this.cloverCount = 40;
        const geometry = new THREE.PlaneGeometry(0.08, 0.08); // Tamanho do trevo
        const material = new THREE.MeshBasicMaterial({
            map: cloverTexture,
            transparent: true,
            opacity: 0.8,
            depthWrite: false, // Não bloqueia o fundo
            side: THREE.DoubleSide
        });

        this.cloverMesh = new THREE.InstancedMesh(geometry, material, this.cloverCount);
        this.scene.add(this.cloverMesh);

        // Dados individuais das partículas
        this.cloverData = [];
        const dummy = new THREE.Object3D();

        // Calcular limites da tela em coordenadas do mundo (World Space)
        const fovY = this.camera.fov * (Math.PI / 180);
        const visibleHeight = 2 * Math.tan(fovY / 2) * this.camera.position.z;
        const visibleWidth = visibleHeight * (this.width / this.height);

        for (let i = 0; i < this.cloverCount; i++) {
            // Posição inicial: Espalhado em X, mas acima do topo em Y
            const x = (Math.random() - 0.5) * visibleWidth;
            const y = (visibleHeight / 2) + Math.random() * visibleHeight; // Acima da tela
            const z = 0.05; // Levemente à frente do fundo

            this.cloverData.push({
                position: new THREE.Vector3(x, y, z),
                velocity: 0.001 + Math.random() * 0.002, // Velocidade de queda variada
                rotationSpeed: (Math.random() - 0.5) * 0.02, // Rotação aleatória
                rotation: Math.random() * Math.PI
            });

            dummy.position.set(x, y, z);
            dummy.rotation.z = this.cloverData[i].rotation;
            dummy.updateMatrix();
            this.cloverMesh.setMatrixAt(i, dummy.matrix);
        }
    }

    animateClovers() {
        // 2. Loop de Animação
        if (!this.cloversFalling || !this.cloverMesh) return;

        const dummy = new THREE.Object3D();
        const fovY = this.camera.fov * (Math.PI / 180);
        const visibleHeight = 2 * Math.tan(fovY / 2) * this.camera.position.z;
        const visibleWidth = visibleHeight * (this.width / this.height);
        const bottomLimit = -visibleHeight / 1.5; // Um pouco abaixo da tela

        for (let i = 0; i < this.cloverCount; i++) {
            const data = this.cloverData[i];

            // Atualiza Posição (Cair)
            data.position.y -= data.velocity;

            // Atualiza Rotação
            data.rotation += data.rotationSpeed;

            // Loop Infinito: Se passar do fundo, volta para o topo
            if (data.position.y < bottomLimit) {
                data.position.y = (visibleHeight / 2) + Math.random() * 0.5;
                data.position.x = (Math.random() - 0.5) * visibleWidth;
            }

            // Aplica transformações
            dummy.position.copy(data.position);
            dummy.rotation.z = data.rotation;
            dummy.updateMatrix();
            this.cloverMesh.setMatrixAt(i, dummy.matrix);
        }

        this.cloverMesh.instanceMatrix.needsUpdate = true;
    }

    onResize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        // Atualiza a proporção da câmera
        this.camera.aspect = this.width / this.height;

        // --- CORREÇÃO MOBILE FORÇADA ---
        if (this.width < 768) {
            // Mobile: Afasta BEM a câmera (2.5) e aumenta o ângulo de visão (FOV 85)
            this.camera.position.z = 2.5;
            this.camera.fov = 85;
        } else {
            // Desktop: Mantém o padrão
            this.camera.position.z = 1.0;
            this.camera.fov = 70;
        }

        this.camera.updateProjectionMatrix();

        // Atualiza o Renderer e os Uniforms
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        if (this.mesh) {
            this.mesh.material.uniforms.uResolution.value.set(this.width, this.height);

            // Recalcula escala do plano para preencher a tela
            const fovY = this.camera.fov * (Math.PI / 180);
            const planeHeight = 2 * Math.tan(fovY / 2) * this.camera.position.z;
            const planeWidth = planeHeight * (this.width / this.height);
            this.mesh.scale.set(planeWidth, planeHeight, 1);
        }
    }

    addListeners() {
        window.addEventListener('resize', this.onResize.bind(this));

        // Recarrega a página se a orientação mudar (Portrait <-> Landscape) para trocar a imagem
        let wasPortrait = window.innerWidth < window.innerHeight;
        window.addEventListener('resize', () => {
            const isPortrait = window.innerWidth < window.innerHeight;
            if (wasPortrait !== isPortrait) {
                location.reload();
            }
        });

        window.addEventListener('mousemove', (e) => {
            // Normaliza mouse (0 a 1)
            state.targetMouse.x = e.clientX / this.width;
            state.targetMouse.y = 1.0 - (e.clientY / this.height); // Inverte Y para WebGL
        });
    }

    render() {
        state.time += 0.01;

        // Suavização do movimento do mouse (Lerp)
        state.mouse.x += (state.targetMouse.x - state.mouse.x) * config.mouseEase;
        state.mouse.y += (state.targetMouse.y - state.mouse.y) * config.mouseEase;

        if (this.mesh) {
            this.mesh.material.uniforms.uTime.value = state.time;
            this.mesh.material.uniforms.uMouse.value.copy(state.mouse);
        }

        this.animateClovers(); // Executa a animação dos trevos
        this.renderer.render(this.scene, this.camera);
        requestAnimationFrame(this.render.bind(this));
    }
}

// Inicialização
const heroApp = new WebGLHero();

/**
 * Lenis Smooth Scroll & GSAP Integration
 */
// 1. Inicializar Lenis
const lenis = new Lenis();

// 2. Conectar Lenis ao GSAP ScrollTrigger para sincronização
lenis.on('scroll', ScrollTrigger.update);

// 3. Configurar loop de animação (requestAnimationFrame)
function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
}

requestAnimationFrame(raf);

/**
 * Hero Animations
 */
document.addEventListener('DOMContentLoaded', () => {
    // Hero Animation Timeline (CORRIGIDA)
    let tl = gsap.timeline({ delay: 0.2 });

    // 1. "Espaço Terapêutico" desliza de cima
    tl.fromTo(".hero-sup-title", 
        { y: -30, opacity: 0 }, 
        { y: 0, opacity: 1, duration: 1, ease: "power3.out" }
    )
    
    // 2. "Bem Me Quer" escala suavemente
    .fromTo(".hero-main-title", 
        { scale: 1.5, opacity: 0 }, 
        { scale: 1, opacity: 1, duration: 1.2, ease: "power2.out" }, 
        "-=0.5"
    )
    
    // 3. Subtítulo sobe
    .fromTo(".hero-subtitle", 
        { y: 20, opacity: 0 }, 
        { y: 0, opacity: 1, duration: 0.8 }, 
        "-=0.8"
    )
    
    // 4. Botão aparece (Correção do desaparecimento)
    .fromTo(".cta-button", 
        { scale: 0.5, opacity: 0 }, // Começa pequeno e invisível
        { scale: 1, opacity: 1, duration: 1, ease: "elastic.out(1, 0.5)", clearProps: "all" }, // Termina normal e visível
        "-=0.4"
    );

    // 5. Gatilho: Inicia a chuva de trevos
    tl.call(() => { 
        if(heroApp) heroApp.cloversFalling = true; 
    });
});

/**
 * Custom Cursor Logic
 */
const cursor = document.querySelector('.cursor');
const hoverElements = document.querySelectorAll('a, button, .btn');

// Verifica se o dispositivo tem suporte a hover (Mouse)
if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    
    // Centraliza o ponto de ancoragem do cursor
    gsap.set(cursor, { xPercent: -50, yPercent: -50 });

    // Configuração de movimento otimizado (quickTo)
    let xTo = gsap.quickTo(cursor, "x", { duration: 0.2, ease: "power3" });
    let yTo = gsap.quickTo(cursor, "y", { duration: 0.2, ease: "power3" });

    window.addEventListener('mousemove', (e) => {
        xTo(e.clientX);
        yTo(e.clientY);
    });

    // Efeitos de Hover
    hoverElements.forEach(el => {
        el.addEventListener('mouseenter', () => cursor.classList.add('active'));
        el.addEventListener('mouseleave', () => cursor.classList.remove('active'));
    });
}

/**
 * Sobre Section Animation
 */
gsap.from(".sobre-text", {
    scrollTrigger: {
        trigger: "#sobre",
        start: "top 80%", // Inicia quando o topo da seção atinge 80% da tela
        toggleActions: "play none none reverse"
    },
    y: 50,
    opacity: 0,
    duration: 1,
    ease: "power3.out"
});

/**
 * Serviços Section Animation (Batch)
 */
// Define estado inicial (invisível e menor)
gsap.set(".service-card", { opacity: 0, scale: 0.8 });

// Animação em lote conforme o scroll
ScrollTrigger.batch(".service-card", {
    onEnter: batch => gsap.to(batch, {
        opacity: 1,
        scale: 1,
        stagger: 0.1, // Intervalo entre cada card
        duration: 0.6,
        ease: "back.out(1.7)", // Efeito de "pop"
        overwrite: true
    })
});

/**
 * Equipe Section: Swiper 3D Coverflow
 */
var swiper = new Swiper(".team-carousel", {
    effect: "coverflow",
    grabCursor: true,
    centeredSlides: true,
    slidesPerView: "auto", // Permite ver os laterais
    loop: true, // Infinito
    coverflowEffect: {
        rotate: 50, // Rotação dos cards laterais
        stretch: 0,
        depth: 100, // Profundidade 3D
        modifier: 1,
        slideShadows: false, // Desligar sombras automáticas para ficar mais limpo
    },
    autoplay: {
        delay: 2500,
        disableOnInteraction: false,
    },
    pagination: {
        el: ".swiper-pagination",
        clickable: true,
    },
});

/**
 * Smooth Scroll for Anchor Links (Lenis Integration)
 */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        if (targetId === '#') return; // Ignora links vazios
        
        lenis.scrollTo(targetId);
    });
});
import * as THREE from 'three';

/**
 * Enhanced Sky System with improved lighting for a more natural look
 * Features:
 * - Soft ambient lighting with GI simulation
 * - Enhanced sun with god rays effect
 * - Atmospheric scattering simulation
 * - Softer shadows with better falloff
 */
export class Sky {
  private skyMesh: THREE.Mesh;
  private sunLight: THREE.DirectionalLight;
  private ambientLight: THREE.AmbientLight;
  private hemisphereLight: THREE.HemisphereLight;
  private fillLight: THREE.DirectionalLight;

  constructor(scene: THREE.Scene) {
    // Create gradient sky sphere with atmospheric scattering
    const skyGeometry = new THREE.SphereGeometry(800, 64, 64);
    const skyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x0066cc) },
        horizonColor: { value: new THREE.Color(0x87ceeb) },
        bottomColor: { value: new THREE.Color(0xadd8e6) },
        sunPosition: { value: new THREE.Vector3(150, 120, 80) },
        sunColor: { value: new THREE.Color(0xffffee) },
        sunIntensity: { value: 1.2 },
        atmosphereStrength: { value: 0.8 }
      },
      vertexShader: `
                varying vec3 vWorldPosition;
                varying vec3 vPosition;
                varying vec3 vNormal;
                
                void main() {
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    vPosition = position;
                    vNormal = normalize(normalMatrix * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
      fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 horizonColor;
                uniform vec3 bottomColor;
                uniform vec3 sunPosition;
                uniform vec3 sunColor;
                uniform float sunIntensity;
                uniform float atmosphereStrength;
                
                varying vec3 vWorldPosition;
                varying vec3 vPosition;
                varying vec3 vNormal;
                
                // Improved color blending
                vec3 blendColors(vec3 a, vec3 b, float t) {
                    t = clamp(t, 0.0, 1.0);
                    // Use smooth hermite interpolation
                    t = t * t * (3.0 - 2.0 * t);
                    return mix(a, b, t);
                }
                
                void main() {
                    float h = normalize(vPosition).y;
                    
                    // Multi-gradient sky with smooth transitions
                    vec3 color;
                    if (h > 0.0) {
                        // Above horizon - blend through multiple colors
                        float t = pow(h, 0.35);
                        
                        // Add atmospheric gradient bands
                        vec3 lowerSky = blendColors(horizonColor, vec3(0.5, 0.7, 0.9), t * 0.3);
                        vec3 upperSky = blendColors(vec3(0.4, 0.6, 0.9), topColor, t);
                        
                        color = blendColors(lowerSky, upperSky, t);
                        
                        // Add subtle warm tint near horizon
                        float horizonBlend = 1.0 - pow(h, 0.2);
                        color = mix(color, vec3(0.95, 0.9, 0.85), horizonBlend * 0.15);
                    } else {
                        // Below horizon - blend to ground reflection
                        float t = -h;
                        color = blendColors(horizonColor, bottomColor, pow(t, 0.5));
                    }
                    
                    // Enhanced sun with atmospheric glow
                    vec3 sunDir = normalize(sunPosition);
                    vec3 viewDir = normalize(vPosition);
                    float sunDot = dot(viewDir, sunDir);
                    
                    // Sun core
                    if (sunDot > 0.995) {
                        float core = smoothstep(0.995, 0.9985, sunDot);
                        color = mix(color, sunColor * sunIntensity, core);
                    }
                    
                    // Inner glow
                    if (sunDot > 0.98) {
                        float innerGlow = smoothstep(0.98, 0.995, sunDot);
                        color = mix(color, sunColor * 0.6, innerGlow * 0.5);
                    }
                    
                    // Outer glow (atmospheric haze)
                    if (sunDot > 0.85) {
                        float outerGlow = smoothstep(0.85, 0.98, sunDot);
                        vec3 glowColor = mix(sunColor, vec3(1.0, 0.9, 0.7), 0.3);
                        color = mix(color, glowColor * 0.4, outerGlow * 0.25 * atmosphereStrength);
                    }
                    
                    // Large atmospheric scatter (god rays simulation)
                    if (sunDot > 0.5) {
                        float scatter = smoothstep(0.5, 0.85, sunDot);
                        color = mix(color, vec3(1.0, 0.95, 0.85), scatter * 0.08 * atmosphereStrength);
                    }
                    
                    // Subtle cloud-like variations
                    float noise = fract(sin(dot(vPosition.xz, vec2(12.9898, 78.233))) * 43758.5453);
                    color += vec3(noise * 0.015);
                    
                    // Apply subtle vignette for depth
                    float vignette = 1.0 - pow(1.0 - abs(h), 4.0) * 0.1;
                    color *= vignette;
                    
                    gl_FragColor = vec4(color, 1.0);
                }
            `,
      side: THREE.BackSide,
      depthWrite: false
    });

    this.skyMesh = new THREE.Mesh(skyGeometry, skyMaterial);
    scene.add(this.skyMesh);

    // === ENHANCED LIGHTING SETUP ===

    // Main Directional Light (Sun) - Warm and soft
    this.sunLight = new THREE.DirectionalLight(0xfff8e1, 1.4);
    this.sunLight.position.set(150, 120, 80);
    this.sunLight.castShadow = true;

    // Enhanced shadow settings for softer shadows
    this.sunLight.shadow.mapSize.width = 4096;
    this.sunLight.shadow.mapSize.height = 4096;
    this.sunLight.shadow.camera.near = 0.1;
    this.sunLight.shadow.camera.far = 600;
    this.sunLight.shadow.camera.left = -150;
    this.sunLight.shadow.camera.right = 150;
    this.sunLight.shadow.camera.top = 150;
    this.sunLight.shadow.camera.bottom = -150;

    // Soft shadow bias for natural look
    this.sunLight.shadow.bias = -0.0003;
    this.sunLight.shadow.normalBias = 0.02;
    this.sunLight.shadow.radius = 2; // Softer shadow edges

    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    // Fill Light - Simulates bounced light from opposite direction
    this.fillLight = new THREE.DirectionalLight(0x87ceeb, 0.3);
    this.fillLight.position.set(-80, 60, -60);
    this.fillLight.castShadow = false;
    scene.add(this.fillLight);

    // Ambient Light - Base illumination with warm tint
    this.ambientLight = new THREE.AmbientLight(0x606080, 0.5);
    scene.add(this.ambientLight);

    // Hemisphere Light - Sky/Ground color difference for natural ambient
    // Sky color (blue) lights from above, ground color (green/brown) from below
    this.hemisphereLight = new THREE.HemisphereLight(
      0x87ceeb,  // Sky color - soft blue
      0x4a7a3d,  // Ground color - soft green/brown
      0.6        // Intensity
    );
    this.hemisphereLight.position.set(0, 100, 0);
    scene.add(this.hemisphereLight);
  }

  public updateSunPosition(playerPosition: THREE.Vector3): void {
    // Keep sun relative to player for consistent lighting
    const sunOffset = new THREE.Vector3(150, 120, 80);
    this.sunLight.position.copy(playerPosition).add(sunOffset);
    this.sunLight.target.position.copy(playerPosition);
    this.sunLight.target.updateMatrixWorld();

    // Update fill light opposite to sun
    const fillOffset = new THREE.Vector3(-80, 60, -60);
    this.fillLight.position.copy(playerPosition).add(fillOffset);

    // Update sky position to follow player
    this.skyMesh.position.copy(playerPosition);

    // Update hemisphere light position
    this.hemisphereLight.position.set(playerPosition.x, playerPosition.y + 100, playerPosition.z);
  }

  /**
   * Set time of day (0-1, where 0 = midnight, 0.5 = noon)
   * Can be used for day/night cycle later
   */
  public setTimeOfDay(time: number): void {
    const material = this.skyMesh.material as THREE.ShaderMaterial;

    // Adjust sun position and colors based on time
    const angle = (time - 0.25) * Math.PI * 2;
    const sunY = Math.sin(angle);
    const sunX = Math.cos(angle);

    material.uniforms.sunPosition.value.set(sunX * 150, sunY * 120 + 50, 80);

    // Adjust colors for sunset/sunrise
    if (time > 0.2 && time < 0.35) { // Sunrise
      const t = (time - 0.2) / 0.15;
      material.uniforms.horizonColor.value.setHex(0xffd4a3);
      material.uniforms.sunColor.value.setHex(0xffaa66);
      this.sunLight.color.setHex(0xffcc88);
      this.sunLight.intensity = 0.8 + t * 0.6;
    } else if (time > 0.65 && time < 0.8) { // Sunset
      const t = (0.8 - time) / 0.15;
      material.uniforms.horizonColor.value.setHex(0xffa07a);
      material.uniforms.sunColor.value.setHex(0xff7744);
      this.sunLight.color.setHex(0xffaa66);
      this.sunLight.intensity = 0.6 + t * 0.8;
    } else if (time > 0.3 && time < 0.65) { // Day
      material.uniforms.horizonColor.value.setHex(0x87ceeb);
      material.uniforms.sunColor.value.setHex(0xffffee);
      this.sunLight.color.setHex(0xfff8e1);
      this.sunLight.intensity = 1.4;
    } else { // Night
      material.uniforms.topColor.value.setHex(0x0a0a20);
      material.uniforms.horizonColor.value.setHex(0x1a1a40);
      this.sunLight.intensity = 0.1;
      this.ambientLight.intensity = 0.2;
    }
  }

  public dispose(): void {
    this.skyMesh.geometry.dispose();
    (this.skyMesh.material as THREE.Material).dispose();
  }
}

window.onload = function() {
    // --- 1. SETUP THREE.JS SCENE CONFIGURATIONS ---
    const container = document.getElementById('canvas-container');
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 0, 4);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(5, 5, 4);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // --- 2. MATERIALS TRACKING CACHE LOGIC ---
    const textureLoader = new THREE.TextureLoader();
    const imageUrls = [
        '/static/images/side1.png', '/static/images/side2.png',
        '/static/images/side3.png', '/static/images/side4.png',
        '/static/images/side5.png', '/static/images/side6.png'
    ];

    // Maintain a background image dictionary string array containing the raw asset content
    let activeTextureBase64Cache = Array(6).fill(null);

    // Load initial presets into materials array
    const materials = imageUrls.map((url, index) => {
        const texture = textureLoader.load(url, (loadedTex) => {
            // Pre-cache initial images as fallback baselines
            const canvas = document.createElement('canvas');
            canvas.width = loadedTex.image.width || 512;
            canvas.height = loadedTex.image.height || 512;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(loadedTex.image, 0, 0);
            activeTextureBase64Cache[index] = canvas.toDataURL('image/png');
        });
        texture.minFilter = THREE.LinearFilter;
        return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.3 });
    });

    const geometry = new THREE.BoxGeometry(1.4, 1.4, 1.4);
    const cube = new THREE.Mesh(geometry, materials);
    cube.castShadow = true;
    scene.add(cube);

    // --- 3. STATE AND PLAYBACK CONTROLS MANAGEMENT ---
    let rotationHistory = [];
    let uploadedPlaybackHistory = null;
    let isPlaying = true;
    let isReplayingUpload = false;
    let replayFrameIndex = 0;

    const logStreamContainer = document.getElementById('telemetry-log-stream');
    const statusLight = document.getElementById('status-light');
    const statusText = document.getElementById('status-text');

    function updateEngineUIState(stateClass, textMsg, colorClass) {
        statusLight.className = 'status-light ' + stateClass;
        statusText.className = 'status-text ' + colorClass;
        statusText.innerText = textMsg;
    }

    function appendTelemetryLog(timestamp, sx, sy, rx, ry, rz) {
        if (rotationHistory.length > 1000) rotationHistory.shift();
        const dataEntry = { timestamp, speedVector: { x: sx, y: sy }, angles: { x: rx.toFixed(3), y: ry.toFixed(3), z: rz.toFixed(3) } };
        rotationHistory.push(dataEntry);

        const row = document.createElement('div');
        row.className = 'log-row';
        row.innerHTML = `<span>${timestamp}</span><span>(${sx.toFixed(3)}, ${sy.toFixed(3)})</span><span>[${dataEntry.angles.x}, ${dataEntry.angles.y}, ${dataEntry.angles.z}]</span>`;
        logStreamContainer.appendChild(row);
        logStreamContainer.scrollTop = logStreamContainer.scrollHeight;
    }

    // --- 4. NAVIGATION ENGINE SYSTEM BUTTON TRIGGERS ---
    document.getElementById('play-btn').addEventListener('click', () => { isPlaying = true; isReplayingUpload = false; updateEngineUIState('state-play', 'PLAYING', 'text-play'); });
    document.getElementById('pause-btn').addEventListener('click', () => { isPlaying = false; updateEngineUIState('state-pause', 'PAUSED', 'text-pause'); });
    document.getElementById('stop-btn').addEventListener('click', () => { isPlaying = false; isReplayingUpload = false; cube.rotation.set(0, 0, 0); updateEngineUIState('state-stop', 'STOPPED', 'text-stop'); });

    // --- 5. ZIP ARCHIVE COMPILATION & EXTRACTION PIPELINE ---
    // Download ZIP Bundle
    document.getElementById('download-bundle-btn').addEventListener('click', async () => {
        const zip = new JSZip();
        
        // Add rotation data text log file
        zip.file("telemetry_history.json", JSON.stringify(rotationHistory, null, 2));
        
        // Add current image layers extracted from memory cache
        for (let i = 0; i < 6; i++) {
            if (activeTextureBase64Cache[i]) {
                const rawData = activeTextureBase64Cache[i].split(',')[1];
                zip.file(`face_texture_${i}.png`, rawData, {base64: true});
            }
        }
        
        const content = await zip.generateAsync({type:"blob"});
        const downloadAnchor = document.createElement('a');
        downloadAnchor.href = URL.createObjectURL(content);
        downloadAnchor.download = `cube_bundle_${Date.now()}.zip`;
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    });

    // Upload ZIP Bundle
    document.getElementById('upload-bundle-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async function(event) {
            try {
                const zip = await JSZip.loadAsync(event.target.result);
                
                // Extract rotation tracking history JSON logs
                const jsonFile = await zip.file("telemetry_history.json").async("string");
                uploadedPlaybackHistory = JSON.parse(jsonFile);
                
                // Extract and update textures dynamically on the fly
                logStreamContainer.innerHTML = '';
                for (let i = 0; i < 6; i++) {
                    const imgFile = zip.file(`face_texture_${i}.png`);
                    if (imgFile) {
                        const base64Data = await imgFile.async("base64");
                        const dataUrl = `data:image/png;base64,${base64Data}`;
                        
                        activeTextureBase64Cache[i] = dataUrl;
                        
                        const img = new Image();
                        img.onload = (function(faceIdx) {
                            return function() {
                                const newTexture = new THREE.Texture(img);
                                newTexture.needsUpdate = true;
                                newTexture.minFilter = THREE.LinearFilter;
                                materials[faceIdx].map = newTexture;
                                materials[faceIdx].needsUpdate = true;
                            };
                        })(i);
                        img.src = dataUrl;
                    }
                }
                
                // Render uploaded historic values to telemetry log UI element board stream grid
                uploadedPlaybackHistory.forEach(entry => {
                    const row = document.createElement('div');
                    row.className = 'log-row';
                    row.style.color = '#8e44ad'; // Purple denotes historical state data elements
                    row.innerHTML = `<span>${entry.timestamp}</span><span>(${entry.speedVector.x}, ${entry.speedVector.y})</span><span>[${entry.angles.x}, ${entry.angles.y}, ${entry.angles.z}]</span>`;
                    logStreamContainer.appendChild(row);
                });

                document.getElementById('play-upload-btn').disabled = false;
                alert("ZIP Bundle loaded successfully! Click 'Play Uploaded Bundle' to watch.");
            } catch (err) { alert("Error parsing ZIP bundle content metrics."); console.error(err); }
        };
        reader.readAsArrayBuffer(file);
    });

    // PLAY UPLOAD EVENT HANDLER
    document.getElementById('play-upload-btn').addEventListener('click', () => {
        if (!uploadedPlaybackHistory || uploadedPlaybackHistory.length === 0) return;
        isReplayingUpload = true;
        isPlaying = false; // Turn off normal auto-spinning mode execution loops
        replayFrameIndex = 0;
        updateEngineUIState('state-play', 'REPLAYING ZIP', 'text-play');
    });

    // --- 6. DRAG EVENTS & USER CUSTOM TEXTURE UPLOADER FILTERS ---
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    container.addEventListener('mousedown', (e) => { isDragging = true; previousMousePosition = { x: e.clientX, y: e.clientY }; });
    window.addEventListener('mouseup', () => { isDragging = false; });
    container.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const deltaMove = { x: e.clientX - previousMousePosition.x, y: e.clientY - previousMousePosition.y };
        if (document.getElementById('rotate-x').checked) cube.rotation.x += deltaMove.y * 0.005;
        if (document.getElementById('rotate-y').checked) cube.rotation.y += deltaMove.x * 0.005;
        previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    for (let i = 0; i < 6; i++) {
        document.getElementById(`upload-${i}`).addEventListener('change', function(e) 
        {
            const file = e.target.files[0];

            if (file) 
            {
                const reader = new FileReader();
                reader.onload = function(event)
                {
                    activeTextureBase64Cache[i] = event.target.result; 
                    // Store raw input asset inside cache matrix array boundary definitions
                    const img = new Image();
                    img.onload = function() 
                    {
                        const newTexture = new THREE.Texture(img);

                        newTexture.needsUpdate = true;

                        newTexture.minFilter = THREE.LinearFilter;

                        materials[i].map = newTexture;
                        
                        materials[i].needsUpdate = true;
                    };
                        
                     img.src = event.target.result;
                 };
                     
                     reader.readAsDataURL(file);
                 }

             });
        }
                        
        // --- 7. RUNTIME PROCESSING SYSTEM ANIMATION PIPELINE LOOP ---
                        
        let frameCounter = 0;function animate() {requestAnimationFrame(animate);if (isReplayingUpload && uploadedPlaybackHistory) {
                            
        // STEP BY STEP SIMULATION OF ACCELEROMETER METRICS IN BUNDLE ARCHIVE
                        
            if (replayFrameIndex < uploadedPlaybackHistory.length)
            {
                const currentState = uploadedPlaybackHistory[replayFrameIndex];
                cube.rotation.x = parseFloat(currentState.angles.x);
                cube.rotation.y = parseFloat(currentState.angles.y);
                cube.rotation.z = parseFloat(currentState.angles.z);
                replayFrameIndex++;
            } 
            else 
            {
                isReplayingUpload = false;updateEngineUIState('state-pause', 'REPLAY DONE', 'text-pause');
            }
        } 
                            
        else {
                            
            // Normal running auto rotation calculations
                            
                const activeRadioX = document.querySelector('input[name="speed-x"]:checked');
                const speedX = activeRadioX ? parseFloat(activeRadioX.value) : 0.01;
                const activeRadioY = document.querySelector('input[name="speed-y"]:checked');

                const speedY = activeRadioY ? parseFloat(activeRadioY.value) : 0.01;
                
                if (isPlaying && !isDragging) 
                {
                    if (document.getElementById('rotate-x').checked) 
                        cube.rotation.x += speedX;

                    if (document.getElementById('rotate-y').checked) 
                        cube.rotation.y += speedY;}frameCounter++;

                    if (frameCounter % 10 === 0 && isPlaying && !isDragging) 
                    {
        
                        appendTelemetryLog(Date.now(), speedX, speedY, cube.rotation.x, cube.rotation.y, cube.rotation.z);}}renderer.render(scene, camera);

                    }
        
         animate();
        
        window.addEventListener('resize', () =>
        {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        });
    };
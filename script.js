console.clear();

// Config
// ------------------------

// Number of vertices to generate on each sphere axis.
const ringCount = 41;
const ringPointCount = 80;
// How many vertices to space apart rendered lines.
const lineSpacing = 4;
const ringSpacing = 2;
// Rendered line colors.
const lineColor = '#fa3';
const ringColor = '#3af';
// Duration of animation when toggling projection mode, in milliseconds.
const modeTransitionDuration = 3000;

// Lightweight canvas adapter. All drawing code is still native 2D canvas commands.
const stage = new Stage({ container: document.body });

// Constants
const TAU = Math.PI * 2;

// State
// ----------------------

// The current projection mode.
let stereographic = true;
// To animate the mode transitions, we need a separate variable.
let modePosition = stereographic ? 1 : 0;
// Animate rotation along 2 axes, Y and Z.
let rotationAutoY = 0;
let rotationAutoZ = 0;
// The rendered rotation (note: interactive rotation is tracked further down).
let rotationFinalY = 0;
let rotationFinalZ = 0;

// Linear interpolation helper, for projection mode transitions.
const lerp = (a, b, x) => (b - a) * x + a;

// Ease-in-out timing function, for projection mode transitions.
function easeInOut(p) {
	if (p < 0.5) {
		p = p * 2;
		return p * p * p * 0.5;
	} else {
		p = 1 - (p - 0.5) * 2
		return 1 - p * p * p * 0.5;
	}
}

// Generates the mesh vertices for a UV sphere.
function generateUvSphereVertices() {
	const vertices = [];
	// Generate in rings and append to flat array.
	for (let i=0; i<ringCount; i++) {
		const ringPos = i / (ringCount - 1) * Math.PI;
		const ringRadius = Math.sin(ringPos);
		const z = Math.cos(ringPos);
		// Poles don't need a full ring.
		// These become the first and last vertices in the array.
		if (z === 1 || z === -1) {
			vertices.push({ x: 0, y: 0, z});
		} else {
			for (let ii=0; ii<ringPointCount; ii++) {
				const angle = ii / ringPointCount * TAU;
				const x = Math.sin(angle) * ringRadius;
				const y = Math.cos(angle) * ringRadius;
				vertices.push({ x, y, z });
			}
		}
	}
	return vertices;
}

// Only need to compute initial vertices once
const baseSphereVertices = generateUvSphereVertices();

// Rotate and project base vertices to 2D plane.
// Recycles vertex objects.
const projectedVertices = [];
baseSphereVertices.forEach(() => projectedVertices.push({ x: 0, y: 0 }));

function getProjectedSphereVertices(angleY, angleZ) {
	// Matrix multiplcation constants only need calculated once for all vertices.
	// TODO: Use quaternions instead
	const sinY = Math.sin(angleY);
	const cosY = Math.cos(angleY);
	const sinZ = Math.sin(angleZ);
	const cosZ = Math.cos(angleZ);
	// Mode changes are animated, and we want to apply an ease to the animation.
	// This only needs to be calculated once.
	const easedPosition = easeInOut(modePosition);
	
	// Using forEach() like map(), but with a recycled array.
	baseSphereVertices.forEach((v, i) => {
		const mappedVertex = projectedVertices[i];
		
		// Z axis rotation
		const x = v.x*cosZ - v.y*sinZ;
		const y = v.x*sinZ + v.y*cosZ;
		const z = v.z;
		// Y axis rotation
		const x1 = x*cosY - z*sinY;
		const y1 = y;
		const z1 = x*sinY + z*cosY;
		// Stereographic Projection
		const inverseZ = 1 - z1;
		const stereographicX = x1 / inverseZ;
		const stereographicY = y1 / inverseZ;
		// Simple perspective projection
		const depth = (1 - ((z1 + 1) / 2)) ** 2 + 1;
		const perspectiveX = x1 * depth;
		const perspectiveY = y1 * depth;
		// Store appropriate projection, or interpolate if animating.
		if (modePosition === 1) {
			mappedVertex.x = stereographicX;
			mappedVertex.y = stereographicY;
		} else if (modePosition === 0) {
			mappedVertex.x = perspectiveX;
			mappedVertex.y = perspectiveY;
		} else {
			mappedVertex.x = lerp(perspectiveX, stereographicX, easedPosition);
			mappedVertex.y = lerp(perspectiveY, stereographicY, easedPosition);
		}
	});
	
	return projectedVertices;
}


// Main loop (rAF)
stage.onTick = function tick({ simTime, simSpeed, width, height }) {
	// Only auto-rotate if user is not interacting.
	if (!pointerIsDown) {
		rotationAutoY += 0.005 * simSpeed;
		rotationAutoZ += 0.005 * simSpeed;
	}
	
	rotationFinalY = rotationAutoY + pointerDelta.x;
	rotationFinalZ = rotationAutoZ + pointerDelta.y;
	
	// Animate mode change
	let modeDirection;
	if (stereographic && modePosition !== 1) {
		modeDirection = 1;
	} else if (!stereographic && modePosition !== 0) {
		modeDirection = -1;
	}
	if (modeDirection) {
		modePosition += simTime / modeTransitionDuration * modeDirection;
		if (modePosition < 0) {
			modePosition = 0;
		} else if (modePosition > 1) {
			modePosition = 1;
		}
	}
};

// Draw loop
stage.onDraw = function draw({ ctx, width, height }) {
	const renderStartTime = performance.now();
	
	const scale = Math.min(width, height) / 4;
	const centerX = width / 2;
	const centerY = height / 2;
	
	// Build adapter on top of moveTo() and lineTo(), so we can avoid drawing super 
	// long lines, and line that connect from one edge of the screen to another. These
	// generally look awful.
	const maxLength = 20; // relative to size of unit circle
	let lastX;
	let lastY;
	// moveTo() is a simple proxy that logs the requested position.
	const moveTo = (x, y) => {
		ctx.moveTo(x, y);
		lastX = x;
		lastY = y;
	};
	// lineTo() only draws a line if it is short enough, otherwise performs a moveTo().
	// This prevents our "optimization" from changing the way valid lines are drawn.
	// It "just works", and our drawing code doesn't know the difference.
	const lineTo = (x, y) => {
		if (Math.abs(x - lastX) < maxLength && Math.abs(y - lastY) < maxLength) {
			ctx.lineTo(x, y);
		} else {
			ctx.moveTo(x, y);
		}
		lastX = x;
		lastY = y;
	};
	
	ctx.globalCompositeOperation = 'source-over';
	ctx.fillStyle = '#000';
	ctx.fillRect(0, 0, width, height);
	
	// Center coordinate system
	ctx.save();
	ctx.translate(centerX, centerY);
	ctx.scale(scale, scale);
	
	const pointRadius = Math.max(0.02, 2 / scale);
	const vertices = getProjectedSphereVertices(rotationFinalY, rotationFinalZ);
	const firstVertex = vertices[0];
	const lastVertex = vertices[vertices.length - 1];

	ctx.strokeStyle = ringColor;
	ctx.lineWidth = 1 / scale;
	ctx.beginPath();
	for (let i=0; i<ringCount-2; i+=ringSpacing) {
		const ringStartIndex = i * ringPointCount + 1;
		const lastVertex = vertices[ringStartIndex + ringPointCount - 1];
		moveTo(lastVertex.x, lastVertex.y);
		for (let ii=0; ii<ringPointCount; ii++) {
			const vertex = vertices[ringStartIndex + ii];
			lineTo(vertex.x, vertex.y);
		}
	}
	ctx.stroke();
	ctx.strokeStyle = lineColor;
	ctx.beginPath();
	for (let i=0; i<ringPointCount; i+=lineSpacing) {
		moveTo(firstVertex.x, firstVertex.y);
		for (let ii=1; ii<ringCount-2; ii++) {
			const vertex = vertices[i + ii * ringPointCount + 1];
			lineTo(vertex.x, vertex.y);
		}
		lineTo(lastVertex.x, lastVertex.y);
	}
	ctx.stroke();
	
	ctx.restore();
	
	updateRenderTime(performance.now() - renderStartTime);
}	

// Simple render time display with a moving average.
const renderTimeNode = document.createElement('div');
renderTimeNode.classList.add('render-time');
document.body.appendChild(renderTimeNode);
const renderTimeLog = [];
function updateRenderTime(timeMs) {
	renderTimeLog.push(timeMs);
	if (renderTimeLog.length > 20) {
		const averageTime = renderTimeLog.reduce((a, b) => a + b) / renderTimeLog.length;
		renderTimeNode.textContent = `Render: ${averageTime.toFixed(2)}ms`;
		renderTimeLog.length = 0;
	}
}


// Interaction
// -----------------------------

// Interaction state
let pointerIsDown = false;
let pointerStart = { x: 0, y: 0 };
let pointerDelta = { x: 0, y: 0 };

// Allow toggling projection mode
const toggleModeBtn = document.createElement('button');
toggleModeBtn.classList.add('toggle-btn');
document.body.appendChild(toggleModeBtn);

function updateToggleBtn() {
	toggleModeBtn.textContent = `STEREOGRAPHIC: ${stereographic ? 'ON' : 'OFF'}`;
}
updateToggleBtn();

toggleModeBtn.addEventListener('click', () => {
	stereographic = !stereographic;
	updateToggleBtn();
});


function handlePointerDown(x, y) {
	if (!pointerIsDown) {
		pointerIsDown = true;
		pointerStart.x = x;
		pointerStart.y = y;
	}
}

function handlePointerUp() {
	pointerIsDown = false;
	// Apply rotation
	rotationAutoY += pointerDelta.x;
	rotationAutoZ += pointerDelta.y;
	// Reset delta
	pointerDelta.x = 0;
	pointerDelta.y = 0;
}

function handlePointerMove(x, y) {
	if (pointerIsDown) {
		const maxRotationX = Math.PI;
		const maxRotationY = Math.PI / 2;
		pointerDelta.x = (x - pointerStart.x) / stage.width * maxRotationX;
		pointerDelta.y = (y - pointerStart.y) / stage.height * maxRotationY;
	}
}


// Use pointer events if available, otherwise fallback to touch events (for iOS).
if ('PointerEvent' in window) {
	document.addEventListener('pointerdown', event => {
		event.isPrimary && handlePointerDown(event.clientX, event.clientY);
	});

	document.addEventListener('pointerup', event => {
		event.isPrimary && handlePointerUp();
	});

	document.addEventListener('pointermove', event => {
		event.isPrimary && handlePointerMove(event.clientX, event.clientY);
	});
} else {
	let activeTouchId = null;
	document.addEventListener('touchstart', event => {
		if (!pointerIsDown) {
			const touch = event.changedTouches[0];
			activeTouchId = touch.identifier;
			handlePointerDown(touch.clientX, touch.clientY);
		}
	});
	document.addEventListener('touchend', event => {
		for (let touch of event.changedTouches) {
			if (touch.identifier === activeTouchId) {
				handlePointerUp();
				break;
			}
		}
	});
	document.addEventListener('touchmove', event => {
		for (let touch of event.changedTouches) {
			if (touch.identifier === activeTouchId) {
				handlePointerMove(touch.clientX, touch.clientY);
				event.preventDefault();
				break;
			}
		}
	}, { passive: false });
}
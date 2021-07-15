// BEGIN CUSTOMIZATION //

// Number of pendulums
var count = 20;
// Duration of entire oscillation cycle (seconds)
var cycle_duration = 40;
// Duration of one full swing of bottom pendulum (seconds)
var max_swing_duration = 2;
// Length of pendulum's arc (degrees)
var arc = 90;

// END CUSTOMIZATION //

// long duration + high resolution waves version
/*
var count = 400;
var cycle_duration = 3600;
var max_swing_duration = 15;
var arc = 360;
*/

// number of swings bottom pendulum makes in full cycle
var min_swings = cycle_duration / max_swing_duration;

// create pendulums such that each one performs one more oscillation per the entire cycle than the pendulum beneath it
for (var i = count - 1; i >= 0; i--) {
	var length = Math.pow(min_swings / (i + min_swings), 2);
	var p = new Pendulum(length, arc, max_swing_duration);
}

// constructs and renders a new pendulum
// length is a relative scale from 0 - 1. Due to the unitless nature, the math can be simplifed.
function Pendulum(length, arc, max_swing_duration, hue) {
	// pendulum representation
	this.node = document.createElement('div');
	this.mass = document.createElement('div');
	this.mass.style.backgroundColor = 'hsla(' + length * 360 + ', 100%, 95%, 0.65)';
	var size = 15 + length * 15;
	this.mass.style.width = size + 'px';
	this.mass.style.height = size + 'px';
	this.mass.style.left = -size / 2 + 'px';
	this.node.appendChild(this.mass);
	// unitless length, 0.0 - 1.0, shortest to longest
	this.length = length;
	this.swing_arc_half = arc / 2;
	// the part of the pendulum equation that matters for calculating a swing period is the square root of the length. All other constants are the same, so ignore them.
	this.swing_duration = max_swing_duration * Math.sqrt(length);
	
	this.node.classList.add('pendulum');
	if (arc <= 180) {
		this.node.style.top = '10%';
		this.node.style.height = 'calc(' + length * 80 + '% - 30px)';
	} else {
		this.node.style.top = '50%';
		this.node.style.height = 'calc(' + length * 40 + '% - 30px)';
	}
	
	document.body.appendChild(this.node);
	
	// animate rotation, forever, using yoyo
	var anim_from = {
		rotation: this.swing_arc_half + 'deg'
	};
	var anim_to = {
		yoyo: true,
		repeat: -1,
		ease: Sine.easeInOut,
		
		rotation: -this.swing_arc_half + 'deg'
	};
	this.animation = TweenMax.fromTo(this.node, this.swing_duration / 2, anim_from, anim_to);
}
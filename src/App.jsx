// Import required libraries and modules
import React, { useEffect, useRef, useState } from "react";
import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";

// Define constant colors
const HOVER_COLOR = new BABYLON.Color4(105 / 255, 10 / 255, 10 / 255, 1);
const GHOST_COLOR = new BABYLON.Color4(50 / 255, 5 / 255, 5 / 255, 1);

// Function to create the Babylon.js scene
function createScene(canvas, engine) {
  const scene = new BABYLON.Scene(engine);
  const camera = new BABYLON.ArcRotateCamera(
    "camera",
    -Math.PI / 2,
    Math.PI / 2,
    5,
    BABYLON.Vector3.Zero(),
    scene
  );
  camera.attachControl(canvas, true);

  new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);

  return [scene, camera];
}

// Function to check if facets share the same vertex indices
function indicesOffacetsShareSameVertex(indices, positions) {
  const shared = Array.from({ length: indices.length }, () => []);

  for (let i = 0; i < indices.length; i++) {
    for (let j = 0; j < indices.length; j++) {
      if (
        positions[3 * indices[i] + 0] === positions[3 * indices[j] + 0] &&
        positions[3 * indices[i] + 1] === positions[3 * indices[j] + 1] &&
        positions[3 * indices[i] + 2] === positions[3 * indices[j] + 2]
      ) {
        shared[indices[i]].push(indices[j]);
      }
    }
  }
  return shared;
}

// Main component
function App() {
  // Refs for canvas, dragging state, and pointer hit info
  const canvasRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [hitInfo, setHitInfo] = useState(null);
  const draggingRef = useRef();
  const hitInfoRef = useRef();
  draggingRef.current = dragging;
  hitInfoRef.current = hitInfo;

  // useEffect hook to set up Babylon.js scene
  useEffect(() => {
    const canvas = canvasRef.current;
    const engine = new BABYLON.Engine(canvas, true);
    const [scene, camera] = createScene(canvas, engine);

    // Create and configure cube mesh
    let cube = BABYLON.MeshBuilder.CreateBox("cube", { size: 1, updatable: true }, scene);
    cube.hasVertexAlpha = true;
    cube.convertToFlatShadedMesh();
    cube.position = new BABYLON.Vector3(0, 0, 0);

    // Handle window resize
    window.addEventListener("resize", function () {
      engine.resize();
    });

    // Render loop
    engine.runRenderLoop(() => {
      scene.render();
    });

    // Get the positions of the vertices in the cube mesh
    let positions = cube.getVerticesData(BABYLON.VertexBuffer.PositionKind);

    // Get the colors of the vertices in the cube mesh
    let colors = cube.getVerticesData(BABYLON.VertexBuffer.ColorKind);

    // If colors are not available, initialize them with default color
    if (!colors)
    colors = Array.from({ length: (positions.length / 3) * 4 }, () => 1);

    // Get the indices that define the cube's triangles
    const indices = cube.getIndices();

    // Calculate shared vertex indices for each facet
    const shared = indicesOffacetsShareSameVertex(indices, positions);

    // Initialize a variable for a temporary plane mesh
    let plane = null;

    // Function to clear the color of all vertices in the cube
    const clearBoxColor = (color) => {
    colors = Array.from({ length: positions.length / 3 }, () =>
        color.asArray()
    ).flat();
    cube.setVerticesData(BABYLON.VertexBuffer.ColorKind, colors);
    };

    // Function to highlight a face of the cube with a given color
    const highlightFace = (face, color) => {
    const facet = 2 * Math.floor(face);

    // Loop through the vertices of the face and update their colors
    for (var i = 0; i < 6; i++) {
        const vertex = indices[3 * facet + i];

        colors[4 * vertex] = color.r;
        colors[4 * vertex + 1] = color.g;
        colors[4 * vertex + 2] = color.b;
        colors[4 * vertex + 3] = color.a;
    }

    // Update the mesh's vertex colors
    cube.setVerticesData(BABYLON.VertexBuffer.ColorKind, colors);
    };

    // Initialize a counter for tracking interactions
    let counter = 0;

    // Set up pointer down event for the scene
    scene.onPointerDown = () => {
    // Pick the mesh under the pointer
    const hit = scene.pick(scene.pointerX, scene.pointerY);

    // If the counter is 0 and a mesh is picked...
    if (counter === 0 && hit.pickedMesh) {
        counter++;

        // Set the dragging state to true
        setDragging(true);

        // Extract face information from the hit
        const face = hit.faceId / 2;
        const facet = 2 * Math.floor(face);
        const normal = hit.getNormal();

        // Set hit information for interaction
        setHitInfo({
        face,
        facet,
        normal,
        position: {
            x: scene.pointerX,
            y: scene.pointerY,
        },
        });

        // Clear the cube's color and highlight the face with a ghost color
        clearBoxColor(new BABYLON.Color4(1, 1, 1, 0.4));
        highlightFace(face, GHOST_COLOR);

        // Create a temporary plane for interaction visualization
        plane = BABYLON.MeshBuilder.CreatePlane("temp", {}, scene);
        // Configure the plane's position, indices, and colors

        plane.setIndices([0, 1, 2, 3, 4, 5]);
        plane.setVerticesData(
        BABYLON.VertexBuffer.PositionKind,
        indices
            .slice(3 * facet, 3 * facet + 6)
            .map((i) => [...positions.slice(3 * i, 3 * i + 3)])
            .flat()
        );
        // Set vertex colors of the plane
        plane.setVerticesData(
        BABYLON.VertexBuffer.ColorKind,
        Array.from({ length: 6 }).fill(HOVER_COLOR.asArray()).flat()
        );
        // Update facet data and convert to flat shading
        plane.updateFacetData();
        plane.convertToFlatShadedMesh();
    }
    // If the counter is 1...
    else if (counter === 1) {
        // Dispose of the temporary plane
        plane.dispose();

        // Reset the counter and reattach camera controls
        counter = 0;
        camera.attachControl(canvas, true);

        // Reset dragging and hit info states
        setDragging(false);
        setHitInfo(null);
    }
    };

    // Function to unproject a 2D point on the canvas to 3D space
    const unproject = ({ x, y }) =>
    BABYLON.Vector3.Unproject(
        new BABYLON.Vector3(x, y, 0),
        engine.getRenderWidth(),
        engine.getRenderHeight(),
        BABYLON.Matrix.Identity(),
        scene.getViewMatrix(),
        scene.getProjectionMatrix()
    );

    // Set up pointer move event for the scene
    scene.onPointerMove = () => {
    // If dragging and hit info are active...
    if (draggingRef.current && hitInfoRef.current) {
        // Detach camera controls
        camera.detachControl();

        // Extract hit info for interaction
        const { facet, normal, position } = hitInfoRef.current;

        // Calculate offset between pointer positions
        const offset = unproject({
        x: scene.pointerX,
        y: scene.pointerY,
        }).subtract(unproject(position));

        // Gather vertices affected by interaction
        const vertices = Array.from(
        new Set(
            indices.slice(3 * facet, 3 * facet + 6).reduce((acc, cur) => {
            acc.push(cur);
            acc.push(...shared[cur]);
            return acc;
            }, [])
        )
        );

        // Update positions of vertices based on interaction
        vertices.forEach((vertex) => {
        for (let j = 0; j < 3; j++) {
            positions[3 * vertex + j] +=
            5 *
            BABYLON.Vector3.Dot(offset, normal) *
            normal.asArray()[j];
        }
        });

        // Update the cube's vertex positions
        cube.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions, true);

        // Update hit info with new pointer position
        setHitInfo({
        ...hitInfoRef.current,
        position: {
            x: scene.pointerX,
            y: scene.pointerY,
        },
        });
    } else {
        // If not dragging, highlight hovered face
        clearBoxColor(new BABYLON.Color4(1, 1, 1, 1));

        const hit = scene.pick(scene.pointerX, scene.pointerY);

        if (hit.pickedMesh) {
        const face = hit.faceId / 2;
        highlightFace(face, HOVER_COLOR);
        }
    }
    };

    // Set up user interface controls using Babylon.js GUI
    const Ui = GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, scene);
    const Reset = GUI.Button.CreateSimpleButton("Reset", "Reset");

    // Add properties to Reset Button
    Reset.widthInPixels = 200;
    Reset.heightInPixels = 80;
    Reset.cornerRadius = 10;
    Reset.horizontalAlignment = 0;
    Reset.verticalAlignment = 1
    Reset.paddingLeft = "25px";
    Reset.paddingBottom = "25px";
    Reset.hoverCursor = "pointer";

    // Add a click event handler to reset the cube's position
    Reset.onPointerClickObservable.add(function () {
    // Dispose of the current cube
    cube.dispose();

    // Create a new cube mesh with default properties
    cube = new BABYLON.MeshBuilder.CreateBox("cube", { size: 1, updatable: true }, scene);
    cube.hasVertexAlpha = true;
    cube.convertToFlatShadedMesh();
    cube.position = new BABYLON.Vector3(0, 0, 0);
    
    // Update positions
    positions = cube.getVerticesData(BABYLON.VertexBuffer.PositionKind);

    // Update colors
    colors = cube.getVerticesData(BABYLON.VertexBuffer.ColorKind);
    if (!colors)
    colors = Array.from({ length: (positions.length / 3) * 4 }, () => 1);

    // Update indices
    indices = cube.getIndices();

    // Update shared
    shared = indicesOffacetsShareSameVertex(indices, positions);

    });

    // Add the reset button to the UI
    Ui.addControl(Reset);

    // Clean up Babylon.js resources when the component unmounts
    return () => {
      scene.dispose();
      engine.dispose();
    };
  }, []);

  // JSX to render the canvas
  return (
    <>
      <canvas ref={canvasRef} style={{ width: "100vw", height: "100vh" }} />
    </>
  );
}

export default App;

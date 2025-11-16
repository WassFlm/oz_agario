const FULL_ANGLE = 2 * Math.PI;
const img = new Image();
img.src = "./img/icon.webp"; // used for viruses

// ---- skin cache for player cells ----
const skinImageCache = {};

function getSkinImage(path) {
    if (!path) return null;

    if (skinImageCache[path]) {
        return skinImageCache[path];
    }

    const image = new Image();
    image.src = path;
    skinImageCache[path] = image;
    return image;
}

// ---- basic round object helper ----
const drawRoundObject = (position, radius, graph) => {
    graph.beginPath();
    graph.arc(position.x, position.y, radius, 0, FULL_ANGLE);
    graph.closePath();
    graph.fill();
    graph.stroke();
};

const drawFood = (position, food, graph) => {
    graph.fillStyle = 'hsl(' + food.hue + ', 100%, 50%)';
    graph.strokeStyle = 'hsl(' + food.hue + ', 100%, 45%)';
    graph.lineWidth = 0;
    drawRoundObject(position, food.radius, graph);
};

const drawVirus = (position, virus, graph) => {
    // draw shape path
    graph.beginPath();
    for (let theta = 0; theta < FULL_ANGLE; theta += FULL_ANGLE / 20) {
        let point = circlePoint(position, virus.radius, theta);
        graph.lineTo(point.x, point.y);
    }
    graph.closePath();

    // If image is not loaded yet, just fallback to solid color
    if (!img.complete || img.naturalWidth === 0) {
        graph.fillStyle = virus.fill;      // or any color
        graph.strokeStyle = virus.stroke;
        graph.lineWidth = virus.strokeWidth;
        graph.fill();
        graph.stroke();
        return;
    }

    // ---- fill with image ----
    graph.save();              // save state before clip
    graph.clip();              // use the polygon as a clipping mask

    graph.drawImage(
        img,
        position.x - virus.radius,
        position.y - virus.radius,
        virus.radius * 2,
        virus.radius * 2
    );

    graph.restore();           // restore clipping

    // outline
    graph.strokeStyle = virus.stroke;
    graph.lineWidth = virus.strokeWidth;
    graph.stroke();
};

const drawFireFood = (position, mass, playerConfig, graph) => {
    graph.strokeStyle = 'hsl(' + mass.hue + ', 100%, 45%)';
    graph.fillStyle = 'hsl(' + mass.hue + ', 100%, 50%)';
    graph.lineWidth = playerConfig.border + 2;
    drawRoundObject(position, mass.radius - 1, graph);
};

const valueInRange = (min, max, value) => Math.min(max, Math.max(min, value));

const circlePoint = (origo, radius, theta) => ({
    x: origo.x + radius * Math.cos(theta),
    y: origo.y + radius * Math.sin(theta)
});

const cellTouchingBorders = (cell, borders) =>
    cell.x - cell.radius <= borders.left ||
    cell.x + cell.radius >= borders.right ||
    cell.y - cell.radius <= borders.top ||
    cell.y + cell.radius >= borders.bottom;

const regulatePoint = (point, borders) => ({
    x: valueInRange(borders.left, borders.right, point.x),
    y: valueInRange(borders.top, borders.bottom, point.y)
});

// Build the geometric path of a cell (circle or "cut" at borders)
const buildCellPath = (cell, borders, graph) => {
    graph.beginPath();

    if (cellTouchingBorders(cell, borders)) {
        let pointCount = 30 + ~~(cell.mass / 5);
        let points = [];
        for (let theta = 0; theta < FULL_ANGLE; theta += FULL_ANGLE / pointCount) {
            let point = circlePoint(cell, cell.radius, theta);
            points.push(regulatePoint(point, borders));
        }
        graph.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            graph.lineTo(points[i].x, points[i].y);
        }
    } else {
        // regular circle
        graph.arc(cell.x, cell.y, cell.radius, 0, FULL_ANGLE);
    }

    graph.closePath();
};

// Original function, now reusing buildCellPath (still used for non-skin stuff if you ever want)
const drawCellWithLines = (cell, borders, graph) => {
    buildCellPath(cell, borders, graph);
    graph.fill();
    graph.stroke();
};

const drawCells = (cells, playerConfig, toggleMassState, borders, graph) => {
    for (let cell of cells) {
        // considering cell.skin is the path of the image we want to render (jpg/webp/png)

        const skinImg = cell.skin ? getSkinImage(cell.skin) : null;
        const canUseSkin =
            skinImg &&
            skinImg.complete &&
            skinImg.naturalWidth > 0 &&
            skinImg.naturalHeight > 0;

        // ---- Draw the cell body (image or solid color) ----
        graph.save(); // isolate state for this cell

        // Build the shape (circle or border-trimmed polygon)
        buildCellPath(cell, borders, graph);

        if (canUseSkin) {
            // Draw the image inside clipped cell shape
            graph.save();
            graph.clip();

            const size = cell.radius * 2;
            graph.drawImage(
                skinImg,
                cell.x - cell.radius,
                cell.y - cell.radius,
                size,
                size
            );

            graph.restore(); // remove clip, keep path

            // Draw border on top
            graph.strokeStyle = cell.borderColor;
            graph.lineWidth = 6;
            graph.stroke();
        } else {
            // Fallback: original color circle
            graph.fillStyle = cell.color;
            graph.strokeStyle = cell.borderColor;
            graph.lineWidth = 6;
            graph.fill();
            graph.stroke();
        }

        graph.restore(); // done with shape; text uses its own styles

        // ---- Draw the name of the player ----
        let fontSize = Math.max(cell.radius / 3, 12);
        graph.lineWidth = playerConfig.textBorderSize;
        graph.fillStyle = playerConfig.textColor;
        graph.strokeStyle = playerConfig.textBorder;
        graph.miterLimit = 1;
        graph.lineJoin = 'round';
        graph.textAlign = 'center';
        graph.textBaseline = 'middle';
        graph.font = 'bold ' + fontSize + 'px sans-serif';
        graph.strokeText(cell.name, cell.x, cell.y);
        graph.fillText(cell.name, cell.x, cell.y);

        // ---- Draw the mass (if enabled) ----
        if (toggleMassState === 1) {
            graph.font = 'bold ' + Math.max(fontSize / 3 * 2, 10) + 'px sans-serif';
            if (cell.name.length === 0) fontSize = 0;
            graph.strokeText(Math.round(cell.mass), cell.x, cell.y + fontSize);
            graph.fillText(Math.round(cell.mass), cell.x, cell.y + fontSize);
        }
    }
};

const drawGrid = (global, player, screen, graph) => {
    graph.lineWidth = 1;
    graph.strokeStyle = global.lineColor;
    graph.globalAlpha = 0.15;
    graph.beginPath();

    for (let x = -player.x; x < screen.width; x += screen.height / 18) {
        graph.moveTo(x, 0);
        graph.lineTo(x, screen.height);
    }

    for (let y = -player.y; y < screen.height; y += screen.height / 18) {
        graph.moveTo(0, y);
        graph.lineTo(screen.width, y);
    }

    graph.stroke();
    graph.globalAlpha = 1;
};

const drawBorder = (borders, graph) => {
    graph.lineWidth = 1;
    graph.strokeStyle = '#000000';
    graph.beginPath();
    graph.moveTo(borders.left, borders.top);
    graph.lineTo(borders.right, borders.top);
    graph.lineTo(borders.right, borders.bottom);
    graph.lineTo(borders.left, borders.bottom);
    graph.closePath();
    graph.stroke();
};

const drawErrorMessage = (message, graph, screen) => {
    graph.fillStyle = '#333333';
    graph.fillRect(0, 0, screen.width, screen.height);
    graph.textAlign = 'center';
    graph.fillStyle = '#FFFFFF';
    graph.font = 'bold 30px sans-serif';
    graph.fillText(message, screen.width / 2, screen.height / 2);
};

module.exports = {
    drawFood,
    drawVirus,
    drawFireFood,
    drawCells,
    drawErrorMessage,
    drawGrid,
    drawBorder
};

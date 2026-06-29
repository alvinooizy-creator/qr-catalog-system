    const express = require("express");
    const QRCode = require("qrcode");
    const fs = require("fs");
    const sharp = require("sharp");
    const app = express();

    app.use(express.urlencoded({ extended: true }));

    app.use("/uploads", express.static("uploads"));

    app.set("view engine", "ejs");

    const multer = require("multer");
    const path = require("path");

    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, "uploads/");
        },
        filename: (req, file, cb) => {
            cb(null, Date.now() + path.extname(file.originalname));
        }
    });

    const upload = multer({ storage });

    app.get("/admin", (req, res) => {
        const products = JSON.parse(
            fs.existsSync("products.json")
                ? fs.readFileSync("products.json", "utf-8")
                : "[]"
        );

        let html = `
        <html>
        <head>
            <title>Admin Dashboard</title>
            <style>
                body {
                    font-family: Arial;
                    background: #f2f2f2;
                    padding: 20px;
                }

                h1 {
                    text-align: center;
                }

                .grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 15px;
                    margin-top: 20px;
                }

                .card {
                    background: white;
                    padding: 15px;
                    border-radius: 12px;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.1);
                    transition: 0.2s;
                }

                .card:hover {
                    transform: scale(1.03);
                }

                img {
                    width: 100%;
                    border-radius: 10px;
                    height: 180px;
                    object-fit: cover;
                }

                a {
                    display: inline-block;
                    margin-top: 8px;
                    padding: 6px 10px;
                    text-decoration: none;
                    border-radius: 6px;
                }

                .view {
                    background: #3498db;
                    color: white;
                }

                .delete {
                    background: #e74c3c;
                    color: white;
                }

                .topbar {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .create {
                    background: black;
                    color: white;
                    padding: 10px 15px;
                    border-radius: 8px;
                    text-decoration: none;
                }
                .image-slider {
                    display: flex;
                    overflow-x: auto;
                    gap: 10px;
                    scroll-snap-type: x mandatory;
                }

                .image-slider img {
                    width: 100vw;
                    height: 100vh;
                    object-fit: cover;
                    flex-shrink: 0;
                    scroll-snap-align: center;

                    transform: translateZ(0);
                    will-change: transform;
                }
                </style>
        </head>
        <body>

            <div class="topbar">
                <h1>Admin Dashboard</h1>
                <a class="create" href="/">+ Create Product</a>
            </div>

            <div class="grid">
        `;

        products.forEach(p => {
            html += `
            <div class="card">
                <div class="image-slider">
                    ${(p.images || []).map(img => `<img src="${img}" />`).join("")}
                </div>
                <h3>${p.name}</h3>
                <p>${p.description}</p>

                <a class="view" href="/product/${p.id}">View</a>
                <a class="delete" href="/delete/${p.id}" onclick="return confirm('Delete this product?')">Delete</a>
            </div>
            `;
        });

        html += `
            </div>
        </body>
        </html>
        `;

        res.send(html);
    });

    app.get("/delete/:id", (req, res) => {
        const fs = require("fs");

        let products = JSON.parse(fs.readFileSync("products.json"));

        // remove product by id
        products = products.filter(p => p.id != req.params.id);

        fs.writeFileSync("products.json", JSON.stringify(products, null, 2));

        res.redirect("/admin");
    });

    // create product + QR
    app.post("/create", upload.array("images", 10), async (req, res) => {
        const fs = require("fs");

        const name = req.body.name;
        const description = req.body.description;

        const products = JSON.parse(fs.readFileSync("products.json"));

        const id = Date.now();

        let images = [];

        // compress images safely
        for (let file of req.files) {

            const outputPath = "uploads/optimized-" + file.filename;

            await sharp(file.path)
                .resize(1000)
                .jpeg({ quality: 70 })
                .toFile(outputPath);

            images.push("/" + outputPath);
        }

        const newProduct = {
            id,
            name,
            description,
            images
        };

        products.push(newProduct);

        fs.writeFileSync("products.json", JSON.stringify(products, null, 2));

        const url = `${req.protocol}://${req.get('host')}/product/${id}`;
        const qr = await QRCode.toDataURL(url);

        res.send(`
            <h2>Product Saved!</h2>
            <p>${name}</p>

            <div class="qr-container">
                <img src="${qr}" class="qr" />
            </div>

            <a href="${qr}" download="qr-${id}.png" class="btn">Download QR</a>

            <br><br>
            <a href="/">Create Another</a>
            <a href="/admin">Admin</a>

            <style>
                body {
                    margin: 0;
                    font-family: Arial;
                    background: #111;
                    color: white;
                    text-align: center;
                }

                .qr-container {
                    height: 75vh;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }

                .qr {
                    width: 85vw;
                    max-width: 350px;
                    background: white;
                    padding: 15px;
                    border-radius: 12px;
                }

                .btn {
                    display: inline-block;
                    margin-top: 10px;
                    padding: 12px 18px;
                    background: #00ffcc;
                    color: black;
                    text-decoration: none;
                    border-radius: 8px;
                }
            </style>
        `);
    });

    // product page
    app.get("/product/:id", (req, res) => {
        const fs = require("fs");
        const products = JSON.parse(fs.readFileSync("products.json"));

        const product = products.find(p => p.id == req.params.id);

        if (!product || !product.images) {
            return res.send("Product not found or corrupted");
        }

        res.send(`
    <html>
    <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <style>
    html, body {
        margin: 0;
        padding: 0;
        height: 100%;
        background: black;
        overflow: hidden;
    }

    /* 📖 SWIPE CONTAINER */
    #container {
        display: flex;
        width: 100vw;
        height: 100vh;
        overflow-x: auto;
        scroll-snap-type: x mandatory;
        -webkit-overflow-scrolling: touch;
    }

    /* 📄 EACH PAGE */
    .page {
        min-width: 100vw;
        height: 100vh;
        scroll-snap-align: center;
        display: flex;
        justify-content: center;
        align-items: center;
    }

    /* 🖼 IMAGE */
    .img {
        width: 100%;
        height: 100%;
        object-fit: contain;

        user-select: none;

        /* IMPORTANT FIX */
        touch-action: pan-x pan-y;
    }

    /* hide scrollbar */
    #container::-webkit-scrollbar {
        display: none;
    }
    </style>
    </head>

    <body>

    <div id="container">
        ${(product.images || []).map(img => `
            <div class="page">
                <img class="img" src="${img}" />
            </div>
        `).join("")}
    </div>

    <script src="https://cdn.jsdelivr.net/npm/@panzoom/panzoom/dist/panzoom.min.js"></script>

    <script>
    const pages = document.querySelectorAll(".page");
    const container = document.getElementById("container");

    function applyFit(panzoom, img) {
        if (!img.naturalWidth) return;

        const scaleX = container.offsetWidth / img.naturalWidth;
        const scaleY = container.offsetHeight / img.naturalHeight;

        const scale = Math.min(scaleX, scaleY, 1);

        requestAnimationFrame(() => {
            panzoom.reset();
            panzoom.zoom(scale);
        });
    }

    pages.forEach((page) => {

        const img = page.querySelector(".img");

        const panzoom = Panzoom(img, {
            maxScale: 4,
            minScale: 1,
            contain: "outside",
            step: 0.2,
            canvas: true
        });
    
        let isZoomed = false;

        img.addEventListener("panzoomchange", () => {
            isZoomed = panzoom.getScale() > 1.05;
            container.style.overflowX = isZoomed ? "hidden" : "auto";
        });

        // 🔥 IMPORTANT: allow swipe unless zoomed
        let isZoomed = false;

        img.addEventListener("panzoomchange", () => {
            isZoomed = panzoom.getScale() > 1.05;

            // disable swipe ONLY when zoomed
            container.style.overflowX = isZoomed ? "hidden" : "auto";
        });

        // 🔥 FIX: wheel zoom (desktop)
        img.parentElement.addEventListener("wheel", panzoom.zoomWithWheel);

        img.style.touchAction = "pan-x pan-y";

             // 👇 IMAGE FIT LOGIC
            if (img.complete) {
                applyFit(panzoom, img);
            } else {
                img.addEventListener("load", () => {
                    applyFit(panzoom, img);
                });
            }
        });

        // 🔥 double tap zoom
        let lastTap = 0;

        page.addEventListener("touchend", (e) => {
            const now = Date.now();

            if (now - lastTap < 300) {

                if (isZoomed) {
                    panzoom.reset();
                } else {
                    panzoom.zoomToPoint(2, {
                        clientX: e.changedTouches[0].clientX,
                        clientY: e.changedTouches[0].clientY
                    });
                }
            }

            lastTap = now;
        });

    });

    </script>

    </body>
    </html>
        `);
    });

    // start server
    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
        console.log("Server running on port " + PORT);
    });

    app.get("/", (req, res) => {
        res.send(`
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>QR Catalog System</title>

            <style>
                body {
                    font-family: Arial, sans-serif;
                    background: #f5f5f5;
                    display: flex;
                    justify-content: center;
                    padding-top: 50px;
                    margin: 0;
                }

                .card {
                    background: white;
                    padding: 25px;
                    border-radius: 12px;
                    width: 90%;
                    max-width: 400px;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                }

                input {
                    width: 100%;
                    padding: 10px;
                    margin-top: 8px;
                    margin-bottom: 12px;
                    box-sizing: border-box;
                    font-size: 16px;
                }

                button {
                    width: 100%;
                    padding: 12px;
                    cursor: pointer;
                    font-size: 16px;
                    background: black;
                    color: white;
                    border: none;
                    border-radius: 8px;
                }

                button:hover {
                    opacity: 0.9;
                }
            </style>
        </head>

        <body>
            <div class="card">
                <h1>Create Product</h1>

                <form method="POST" action="/create" enctype="multipart/form-data">
                    <input name="name" placeholder="Product Name" required />
                    <input name="description" placeholder="Description" required />

                    <input type="file" name="images" multiple required />

                    <button type="submit">Create + Generate QR</button>
                </form>
            </div>
        </body>
        </html>
        `);
    });
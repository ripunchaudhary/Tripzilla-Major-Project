const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");

const Listing = require("./models/listing.js");
const wrapAsync = require("./utils/wrapAsync.js");
const ExpressError = require("./utils/ExpressError.js");
const { listingSchema } = require("./schema.js");

// App Configurations
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "/views"));
app.engine("ejs", ejsMate);

// Middleware
app.use(express.static("public"));
// app.use(express.static(path.join(__dirname, "/public")));
app.use(express.urlencoded({ extended: true })); // Parse form data
app.use(express.json()); // Parse JSON
app.use(methodOverride("_method")); // Override methods like PUT/DELETE


// MongoDB Connection
const { data: sampleListings } = require("./init/data.js");

async function main() {
    console.log("Connecting to MongoDB...");
    try {
        await mongoose.connect("mongodb://127.0.0.1:27017/airbnb");
        console.log("✅ MongoDB Connected");

        const count = await Listing.countDocuments({});
        if (count === 0) {
            console.log("No listings found, inserting sample data...");
            await Listing.insertMany(sampleListings);
            console.log("✅ Sample data inserted");
        }

        app.listen(8080, () => {
            console.log("🚀 Server is running on http://localhost:8080");
        });
    } catch (err) {
        console.error("❌ MongoDB connection error:", err);
    }
}
main();


// Validation Middleware

const validateListing = (req, res, next) => {
    // Validate the listing data using Joi schema
    let { error } = listingSchema.validate(req.body.listing);

    if (error) {
        // Map through all errors and join them as a single message
        let errMsg = error.details.map(el => el.message).join(", ");
        throw new ExpressError(400, errMsg);
    } else {
        next();
    }
};


// Routes


// Home route
app.get("/", (req, res) => {
    res.send("HII, it's working!");
});

// Show all listings
app.get("/listings", wrapAsync(async (req, res) => {
    const allListings = await Listing.find({});
    res.render("./listings/index.ejs", { allListings });
}));

// Form to create new listing
app.get("/listings/new", (req, res) => {
    res.render("./listings/new.ejs");
});

// Create new listing
app.post("/listings", validateListing, wrapAsync(async (req, res) => {
    const newListing = new Listing(req.body.listing);
    await newListing.save();
    res.redirect("/listings");
}));

// Show a particular listing by ID
app.get("/listings/:id", wrapAsync(async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);

    if (!listing) {
        throw new ExpressError(404, "Listing not found!");
    }

    res.render("./listings/show.ejs", { listing });
}));

// Edit form for a listing
app.get("/listings/:id/edit", wrapAsync(async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);

    if (!listing) {
        throw new ExpressError(404, "Listing not found!");
    }

    res.render("./listings/edit.ejs", { listing });
}));

// Update a listing
app.put("/listings/:id", validateListing, wrapAsync(async (req, res) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);

    if (!listing) {
        throw new ExpressError(404, "Listing not found!");
    }

    // Provide a default image if none provided
    if (!req.body.listing.image || !req.body.listing.image.url) {
        req.body.listing.image = {
            url: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=800&q=60"
        };
    }

    listing.set(req.body.listing);
    await listing.save();

    res.redirect(`/listings/${id}`);
}));

// Delete a listing
app.delete("/listings/:id", wrapAsync(async (req, res) => {
    const { id } = req.params;
    const deletedList = await Listing.findByIdAndDelete(id);

    if (!deletedList) {
        throw new ExpressError(404, "Listing not found!");
    }

    res.redirect("/listings");
}));

// Test error route
app.get("/testerror", (req, res, next) => {
    next(new ExpressError(400, "Testing error"));
});

// Catch-all route for 404
app.all("*", (req, res, next) => {
    next(new ExpressError(404, "Page not found!"));
});


// Error Handling Middleware
app.use((err, req, res, next) => {
    const { status = 500, message = "Something went wrong!" } = err;
    res.status(status).render("error.ejs", { message, status });
});

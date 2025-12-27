const Driver = require('../models/Driver');
const Optimization = require('../models/Optimization');

// Get all drivers for the logged-in user
exports.getDrivers = async (req, res) => {
    try {
        const drivers = await Driver.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.json(drivers);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Get single driver
exports.getDriverById = async (req, res) => {
    try {
        const driver = await Driver.findById(req.params.id);
        if (!driver) return res.status(404).json({ msg: 'Driver not found' });
        if (driver.user.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized' });
        }
        res.json(driver);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') return res.status(404).json({ msg: 'Driver not found' });
        res.status(500).send('Server error');
    }
};

// Create driver
exports.createDriver = async (req, res) => {
    const { name, driverId, phone, email, licenseNumber, address } = req.body;

    try {
        // Check uniqueness of driverId for this user? Or globally? Currently schema says unique globally.
        // Let's check generally.
        let existing = await Driver.findOne({ driverId });
        if (existing) {
            return res.status(400).json({ msg: 'Driver ID already exists' });
        }

        const newDriver = new Driver({
            user: req.user.id,
            name,
            driverId,
            phone,
            email,
            licenseNumber,
            address
        });

        const driver = await newDriver.save();
        res.json(driver);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Update driver
exports.updateDriver = async (req, res) => {
    const { name, phone, email, licenseNumber, address, status } = req.body;

    try {
        let driver = await Driver.findById(req.params.id);
        if (!driver) return res.status(404).json({ msg: 'Driver not found' });
        if (driver.user.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized' });
        }

        driver.name = name || driver.name;
        driver.phone = phone || driver.phone;
        driver.email = email || driver.email;
        driver.licenseNumber = licenseNumber || driver.licenseNumber;
        driver.address = address || driver.address;
        driver.status = status || driver.status;

        await driver.save();
        res.json(driver);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Delete driver
exports.deleteDriver = async (req, res) => {
    try {
        const driver = await Driver.findById(req.params.id);
        if (!driver) return res.status(404).json({ msg: 'Driver not found' });
        if (driver.user.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'User not authorized' });
        }

        await Driver.deleteOne({ _id: req.params.id });
        res.json({ msg: 'Driver removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

// Get Routes for a Driver (Portal Feature)
// This searches all optimizations for routes assigned to a specific driver ID (or License)
exports.getDriverRoutes = async (req, res) => {
    // This is a public/semi-public endpoint, or protected.
    // Ideally protected, but for "Driver Portal" we might need a simpler auth.
    // For now, let's assume we pass the Driver's Db ID or we look up by License.

    // NOTE: This controller method might need to be in a separate public route or careful with auth.
    // If we use 'auth' middleware, we expect a logged in User (Manager).
    // But drivers might not have User accounts.
    // Let's make a separate "Simple Login" for drivers in the Auth controller later if needed.
    // For now, let's assume this is called by the Manager or a protected endpoint.

    // However, the request is "each driver can see their route".
    // We will implement a special public endpoint: POST /api/drivers/portal-login
    // that returns a temporary token or just the data if we skip strict auth for demo.

    try {
        const { licenseNumber } = req.body; // Simple auth
        if (!licenseNumber) return res.status(400).json({ msg: 'License number required' });

        const driver = await Driver.findOne({ licenseNumber });
        if (!driver) return res.status(404).json({ msg: 'Driver not found' });

        // Find optimizations that have routes with this driver
        // We need to look into algorithmResults.routes.driver
        const optimizations = await Optimization.find({
            $or: [
                { "routes.driverId": driver._id },
                { "algorithmResults.routes.driverId": driver._id }
            ]
        }).sort({ createdAt: -1 }).limit(10);

        // Extract specific routes
        let assignedRoutes = [];
        optimizations.forEach(opt => {
            if (opt.algorithmResults && opt.algorithmResults.length > 0) {
                // Assuming we use the best result or the first one if "selected" isn't stored
                // For simplicity, let's grab from the first result or the "best" one if marked.
                // Ideally `Optimization` should have a `selectedRouteIndex` or `finalRoutes`.
                // Let's assume index 0 for now as the "active" plan.
                const result = opt.routes.length > 0 ? opt : null;
                // We should check the main 'routes' array of the optimization as that's where assignments are saved.
                if (result) {
                    result.routes.forEach((route, index) => {
                        // Check if route.driverId matches the found driver's _id
                        if (route.driverId && route.driverId.toString() === driver._id.toString()) {
                            assignedRoutes.push({
                                optimizationId: opt._id, // KEY ADDITION
                                routeIndex: index,       // KEY ADDITION
                                optimizationName: opt.name,
                                date: opt.createdAt,
                                route: route
                            });
                        }
                    });
                }
            } else if (opt.routes && opt.routes.length > 0) {
                // Fallback if algorithmResults is empty but top-level routes exist
                opt.routes.forEach((route, index) => {
                    if (route.driverId && route.driverId.toString() === driver._id.toString()) {
                        assignedRoutes.push({
                            optimizationId: opt._id, // KEY ADDITION
                            routeIndex: index,       // KEY ADDITION
                            optimizationName: opt.name,
                            date: opt.createdAt,
                            route: route
                        });
                    }
                });
            }
        });

        res.json({ driver, routes: assignedRoutes });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
};

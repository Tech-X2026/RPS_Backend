import TransportRoute from '../models/TransportRoute.js';
import Student from '../models/Student.js';

/**
 * @desc    Create transport route
 * @route   POST /api/transport/create
 */
export const createRoute = async (req, res) => {
  try {
    const { routeName, routeNumber, stops, vehicleNumber, driverName, driverPhone } = req.body;

    if (!routeName || !routeNumber) {
      return res.status(400).json({ message: 'Route name and number are required' });
    }

    const route = await TransportRoute.create({
      routeName,
      routeNumber: routeNumber.toUpperCase(),
      stops: stops || [],
      vehicleNumber: vehicleNumber || '',
      driverName: driverName || '',
      driverPhone: driverPhone || '',
    });

    res.status(201).json(route);
  } catch (error) {
    console.error('Create route error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Route number already exists' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Get all transport routes
 * @route   GET /api/transport/all
 */
export const getAllRoutes = async (req, res) => {
  try {
    const routes = await TransportRoute.find({}).sort({ routeNumber: 1 });

    // For each route, count students assigned
    const routesWithCount = await Promise.all(
      routes.map(async (route) => {
        const studentCount = await Student.countDocuments({ transportRoute: route._id });
        return { ...route.toObject(), studentCount };
      })
    );

    res.json(routesWithCount);
  } catch (error) {
    console.error('Get routes error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Get single route with students
 * @route   GET /api/transport/:id
 */
export const getRouteById = async (req, res) => {
  try {
    const route = await TransportRoute.findById(req.params.id);
    if (!route) return res.status(404).json({ message: 'Route not found' });

    const students = await Student.find({ transportRoute: route._id })
      .select('uid studentName className section transportStop feesStructure.transportFees')
      .sort({ transportStop: 1, studentName: 1 });

    res.json({ route, students });
  } catch (error) {
    console.error('Get route error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Update transport route
 * @route   PUT /api/transport/update/:id
 */
export const updateRoute = async (req, res) => {
  try {
    const route = await TransportRoute.findById(req.params.id);
    if (!route) return res.status(404).json({ message: 'Route not found' });

    const { routeName, stops, vehicleNumber, driverName, driverPhone, isActive } = req.body;

    if (routeName !== undefined) route.routeName = routeName;
    if (stops !== undefined) route.stops = stops;
    if (vehicleNumber !== undefined) route.vehicleNumber = vehicleNumber;
    if (driverName !== undefined) route.driverName = driverName;
    if (driverPhone !== undefined) route.driverPhone = driverPhone;
    if (isActive !== undefined) route.isActive = isActive;

    await route.save();
    res.json(route);
  } catch (error) {
    console.error('Update route error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * @desc    Delete transport route
 * @route   DELETE /api/transport/delete/:id
 */
export const deleteRoute = async (req, res) => {
  try {
    const route = await TransportRoute.findById(req.params.id);
    if (!route) return res.status(404).json({ message: 'Route not found' });

    // Unlink students
    await Student.updateMany(
      { transportRoute: route._id },
      { $set: { transportRoute: null, transportStop: '' } }
    );

    await TransportRoute.findByIdAndDelete(req.params.id);
    res.json({ message: 'Route deleted successfully' });
  } catch (error) {
    console.error('Delete route error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * @desc    Assign student to a route/stop
 * @route   POST /api/transport/assign-student
 */
export const assignStudent = async (req, res) => {
  try {
    const { studentId, routeId, stopName } = req.body;

    if (!studentId || !routeId) {
      return res.status(400).json({ message: 'Student ID and route ID are required' });
    }

    const route = await TransportRoute.findById(routeId);
    if (!route) return res.status(404).json({ message: 'Route not found' });

    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });

    // Find the stop fee
    let stopFee = 0;
    if (stopName) {
      const stop = route.stops.find((s) => s.stopName === stopName);
      if (stop) stopFee = stop.fee;
    }

    student.transportRoute = routeId;
    student.transportStop = stopName || '';

    // Update transport fees based on stop fee (if not custom)
    if (!student.customFees?.isCustom) {
      student.feesStructure.transportFees = stopFee;
    }

    await student.save();
    res.json(student);
  } catch (error) {
    console.error('Assign student error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const Project = require('../models/Project.model');
const File = require('../models/File.model');
const Message = require('../models/Message.model');
const User = require('../models/User.model');

const createProject = async (req, res, next) => {
  try {
    const name = req.body.name || 'Untitled Project';
    const project = await Project.create({ name, owner: req.user._id });
    res.status(201).json({ success: true, project });
  } catch (error) {
    next(error);
  }
};

const getProjects = async (req, res, next) => {
  try {
    const projects = await Project.find({
      $or: [{ owner: req.user._id }, { 'collaborators.user': req.user._id }],
    })
      .populate('owner', 'name email')
      .sort({ updatedAt: -1 });

    res.status(200).json({ success: true, count: projects.length, projects });
  } catch (error) {
    next(error);
  }
};

const getProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('collaborators.user', 'name email avatar');

    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const isAuthorized =
      project.owner._id.equals(req.user._id) ||
      project.collaborators.some((collab) => collab.user._id.equals(req.user._id));

    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    res.status(200).json({ success: true, project });
  } catch (error) {
    next(error);
  }
};

const updateProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    if (!project.owner.equals(req.user._id)) {
      return res.status(403).json({ success: false, error: 'Only owner can update project' });
    }

    if (req.body.name) {
      project.name = req.body.name;
    }

    await project.save();
    res.status(200).json({ success: true, project });
  } catch (error) {
    next(error);
  }
};

const deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    if (!project.owner.equals(req.user._id)) {
      return res.status(403).json({ success: false, error: 'Only owner can delete project' });
    }

    await File.deleteMany({ project: project._id });
    await Message.deleteMany({ project: project._id });
    await project.deleteOne();

    res.status(200).json({ success: true, message: 'Project deleted' });
  } catch (error) {
    next(error);
  }
};

const addCollaborator = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const exists = project.collaborators.some((collab) => collab.user.equals(user._id));
    if (exists || project.owner.equals(user._id)) {
      return res.status(400).json({ success: false, error: 'User is already a collaborator' });
    }

    project.collaborators.push({ user: user._id, role: 'editor' });
    await project.save();

    res.status(200).json({ success: true, project });
  } catch (error) {
    next(error);
  }
};

const removeCollaborator = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    project.collaborators = project.collaborators.filter((collab) => !collab.user.equals(req.params.userId));
    await project.save();

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

const saveWhiteboard = async (req, res, next) => {
  try {
    const { state } = req.body;
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const isAuthorized =
      project.owner.equals(req.user._id) ||
      project.collaborators.some((collab) => collab.user.equals(req.user._id));

    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    project.whiteboardState = Array.isArray(state) ? state : [];
    await project.save();

    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

const getWhiteboard = async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const isAuthorized =
      project.owner.equals(req.user._id) ||
      project.collaborators.some((collab) => collab.user.equals(req.user._id));

    if (!isAuthorized) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    res.status(200).json({ success: true, whiteboardState: project.whiteboardState });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createProject,
  getProjects,
  getProject,
  updateProject,
  deleteProject,
  addCollaborator,
  removeCollaborator,
  saveWhiteboard,
  getWhiteboard,
};

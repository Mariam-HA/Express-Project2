const Review = require("../../models/Review");
const Movie = require("../../models/Movie");


exports.fetchReview = async (reviewId, next) => {
  try {
    const review1 = await Review.findById(reviewId);
    return review1;
  } catch (error) {
    return next(error);
  }
};

exports.getReview = async (req, res, next) => {
  try {
    if (!req.user.isStaff)
      return next({ status: 401, message: "La tsthbl ent mo admin!!!" });

    const { page = 1, limit = 10 } = req.query;
    // execute query with page and limit values
    const reviews = await Review.find()
      .select("-__v")
      .populate("movieId userId", "name username")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
    
    const count = await Review.countDocuments();

    
    return res.status(200).json({
      reviews,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
    });
  } catch (error) {
    return next(error);
  }
};

exports.getMyReviews = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const reviews = await Review.find({ userId: { _id: req.user._id } })
      .select("-__v -userId")
      .populate("movieId", "name")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();
    
    const count = await Review.countDocuments();

    if (reviews.length <= 0)
      return res.status(200).json({ message: "you have zero reviews!" });
    
    return res.status(200).json({
      reviews,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
    });
  } catch (error) {
    return next(error);
  }
};

exports.addReview = async (req, res, next) => {
  try {
    
    const { movieId } = req.params;
    const foundMovie = await Movie.findById({ _id: movieId }).populate(
      "reviews"
    );
    if (!foundMovie) return next({ status: 404, message: "Movie not found" });

    
    let reviewed = false;
    if (foundMovie.reviews.length > 0) {
      foundMovie.reviews.forEach((review) =>
        review.userId._id.equals(req.user._id)
          ? (reviewed = true)
          : (reviewed = false)
      );
    }

    if (reviewed)
      return next({
        status: 401,
        message: `you have already reviewed ${foundMovie.name}`,
      });

    req.body.userId = req.user._id;
    req.body.movieId = foundMovie._id;
    const newReview = await Review.create(req.body);
      // to count the average rating 
    let counter = 0;
    let total = 0;
    foundMovie.reviews.push(newReview);
    foundMovie.reviews.forEach((review) => {
      if (review.rating >= 0) {
        total += review.rating;
        counter++;
      }
    });

    const averageRate = Number((total / counter).toFixed(1));
    
    await req.user.updateOne({
      $push: { reviews: newReview._id },
    });
    await foundMovie.updateOne({
      $push: { reviews: newReview._id },
    });

    if (foundMovie.reviews.length >= 1) {
      await foundMovie.updateOne({
        $set: { averageRate },
      });
    } else if (foundMovie.reviews.length == 0) {
      await foundMovie.updateOne({
        $set: { averageRate: newReview.rating },
      });
    }
    

    res.status(201).json(newReview);
  } catch (err) {
    return res.status(500).json(err.message);
  }
};

exports.updateReview = async (req, res, next) => {
  try {
    if (!req.user.isStaff && !req.user._id.equals(req.review.userId._id))
      return next({ status: 401, message: "You are not an admin !!!!" });

    const updatedReview = await Review.findOneAndUpdate(
      req.review._id,
      req.body,
      {
        new: true,
      }
    );
    return res.status(201).json(updatedReview);
  } catch (error) {
    return next(error);
  }
};

exports.deleteReview = async (req, res, next) => {
  try {
    if (!req.user.isStaff && !req.user._id.equals(req.review.userId._id))
      return next({ status: 401, message: "You are not an admin !!!!" });

    await req.review.deleteOne();
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
};
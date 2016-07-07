/**
 * API Result Standarization.
 *
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @version 1.0.1
 * @license MIT
 **/

module.exports = () => { return (req, res, next) => {
  res.error = (status, message) => {
    if(!message) {
      message = status;
      status = 200;
    }

    if(!message) {
      return res.status(status).send();
    }

    return res.status(status).send({
      success: false,
      message: message
    });
  };

  res.success = (data) => {
    return res.send({
      success: true,
      data: data
    })
  };

  return next();
}};

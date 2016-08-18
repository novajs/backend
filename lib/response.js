/**
 * API Result Standarization.
 *
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @version 1.0.1
 * @license MIT
 **/

let gateway = () => {
  return {
    container: global.container.long,
    time: Date.now()
  }
}

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
      message: message,
      gateway: gateway()
    });
  };

  res.success = (data) => {
    return res.send({
      success: true,
      data: data,
      gateway: gateway()
    })
  };

  return next();
}};

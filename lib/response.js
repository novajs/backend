/**
 * API Result Standarization.
 *
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @version 1.0.1
 * @license MIT
 **/

let debug = require('debug')('backend:response');

let gateway = () => {
  return {
    container: global.container.long,
    time: Date.now()
  }
}

module.exports = () => { return (req, res, next) => {
  debug('req', req.ip)
  res.error = (status, message) => {
    if(!message) {
      message = status;
      status = 200;
    }

    if(!message) {
      return res.status(status).send();
    }

    return res.format({
      success: false,
      message: message,
      gateway: gateway()
    }, status);
  };

  res.success = (data) => {
    return res.format({
      success: true,
      data: data,
      gateway: gateway()
    })
  };

  res.format = (obj, status = 200) => {
    function syntaxHighlight(json) {
        json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
            var cls = 'number';
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'key';
                } else {
                    cls = 'string';
                }
            } else if (/true|false/.test(match)) {
                cls = 'boolean';
            } else if (/null/.test(match)) {
                cls = 'null';
            }
            return '<span class="' + cls + '">' + match + '</span>';
        });
    }

    if(req.query.pretty) {
      let str = JSON.stringify(obj, undefined, 2);
      return res.status(status).send(
        '<!DOCTYPE html><html><style> pre { font-size: 11px; outline: 1px solid #ccc; padding: 5px; margin: 5px; } \
        .string { color: green; } \
        .number { color: darkorange; } \
        .boolean { color: blue; } \
        .null { color: magenta; } \
        .key { color: red; }</style>\n<pre>'
        + syntaxHighlight(str) + '</pre></html>'
      )
    }

    return res.status(status).send(obj);
  }

  return next();
}};

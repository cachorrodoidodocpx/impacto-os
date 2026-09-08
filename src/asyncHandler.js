// Express 4 não captura erros de funções async sozinho: se a Promise rejeitar,
// a requisição fica pendurada. Esse helper garante que o erro chegue no
// middleware de erro do server.js.
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };

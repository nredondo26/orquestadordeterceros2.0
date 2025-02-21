// config.js
module.exports = {
    api: {
        //produccion
        url: 'https://orquestador-pasarelas-gateway-alcance.crediservices.credibanco.com/credibanco/api/pasarelas/orquestador/v1/externo/notificaciones/terminales',
        authorization: 'Basic Y3JlZGliYW5jb3BydWViYXM6Q29sb21iaWEyMyo='

        //pruebas
        //url: 'https://orquestador-pasarelas-migracion-pasarelas-pre-prod.apps-pruebas.credibanco.com/credibanco/api/pasarelas/orquestador/v1/externo/notificaciones/terminales',
        //authorization: 'Basic cGFzYXJlbGFzLXVzZXItdGVzdDpDb2xvbWJpYS4yMDI1'
    },
    server: {
        port: 3001,
        uploadFolder: 'uploads'
    }
};

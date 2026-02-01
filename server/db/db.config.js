    const {Sequelize} = require ('sequelize');

    const DATABASE_URL="postgresql://postgres.gzsueiiupscooclumpzn:vastu@digita@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
    

    const sequelize = new Sequelize(DATABASE_URL, {
        dialect: 'postgres',
        protocol: 'postgres',
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false
            }
        }
    });
    const connectDb = async () => {
        try {
            await sequelize.authenticate();

            await sequelize.sync({alter:false, force:false});
            
            console.log('Connection has been established successfully.');
        } catch (error) {
            console.error('Unable to connect to the database:', error);
        }
    };

    module.exports = {connectDb, sequelize};
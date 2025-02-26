
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId  } = require('mongodb');

app.use(cors());
app.use(express.json());





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.znorp.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;



// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  
  connectTimeoutMS: 60000,
  socketTimeoutMS: 60000,
  maxPoolSize: 50, 
  minPoolSize: 10, 
});

async function run() {
  try {
    await client.connect();
    await client.db('admin').command({ ping: 1 });

    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    );
    const dadDB = client.db('dadDB');
    const usersCollection = dadDB.collection('users');
    const tasksCollection = dadDB.collection('tasks');



    app.post('/users', async (req, res) => {
      try {
        const user = req.body;
        console.log(user, '1');
        const findUser = await usersCollection.findOne({ email: user.email });
        if (findUser) {
          return res.status(200).send({
            success: true,
            message: 'User login successfully',
            data: findUser,
          });
        }
        const result = await usersCollection.insertOne(user);
        console.log(result);
        res.status(201).send({
          success: true,
          message: 'User created successfully',
          data: result,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: 'Failed to create user',
          error: error.message,
        });
      }
    });



    app.get('/users', async (req, res) => {
        try {
          const users = await usersCollection.find({}).toArray();
          res.status(200).json({
            success: true,
            message: 'Users fetched successfully',
            data: users,
          });
        } catch (error) {
          res.status(500).json({
            success: false,
            message: 'Failed to fetch users',
            error: error.message,
          });
        }
      });




    app.post('/tasks', async (req, res) => {
      try {
        const task = req.body;
        console.log(task, '1');

        const maxTask = await tasksCollection
          .find({})
          .sort({ id: -1 })
          .limit(1)
          .toArray();

        const newId = maxTask.length > 0 ? maxTask[0].id + 1 : 1;

        const result = await tasksCollection.insertOne({
          ...task,
          orderid: newId,
          id: newId,
        });
        console.log(result);

        res.status(201).send({
          success: true,
          message: 'Task created successfully',
          data: result,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: 'Failed to create task',
          error: error.message,
        });
      }
    });



    app.get('/tasks', async (req, res) => {
      try {
        const result = await tasksCollection
          .find({})
          .sort({ orderid: 1 })
          .toArray();
        res.status(200).send({
          success: true,
          message: 'Tasks fetched successfully',
          data: result,
        });
        console.log(result, 'success');
      } catch (error) {
        res.status(500).send({
          success: false,
          message: 'Failed to fetch tasks',
          error: error.message,
        });
      }
    });




    app.put('/tasks', async (req, res) => {
      try {
        const tasks = req.body;
        console.log('Received updated tasks:', tasks);

        if (!Array.isArray(tasks)) {
          return res
            .status(400)
            .json({ success: false, message: 'Invalid data format' });
        }

        const bulkOps = tasks.map((task) => ({
          updateOne: {
            filter: { _id: new ObjectId(task._id) }, 
            update: {
              $set: {
                columnId: task.columnId,
                orderid: task.orderid,
                category:
                  task.columnId === '3'
                    ? 'Done'
                    : task.columnId === '2'
                    ? 'In progress'
                    : 'To do',
              },
            }, 
          },
        }));

        await tasksCollection.bulkWrite(bulkOps);

        res
          .status(200)
          .json({ success: true, message: 'Tasks updated successfully!' });
      } catch (error) {
        console.error('Error updating tasks:', error);
        res.status(500).json({
          success: false,
          message: 'Failed to update tasks',
          error: error.message,
        });
      }
    });




    app.delete('/tasks/:id', async (req, res) => {
      const { id } = req.params;
      try {
        const taskToDelete = await tasksCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!taskToDelete) {
          return res.status(404).send({
            success: false,
            message: 'Task not found',
          });
        }

        const result = await tasksCollection.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
          return res.status(404).send({
            success: false,
            message: 'Failed to delete task',
          });
        }

        const tasks = await tasksCollection
          .find({})
          .sort({ orderid: 1 })
          .toArray();

        if (taskToDelete.orderid !== tasks[tasks.length - 1]?.orderid) {
          await tasksCollection.updateMany(
            { orderid: { $gt: taskToDelete.orderid } },
            { $inc: { orderid: -1 } }
          );
        }

        res.status(200).send({
          success: true,
          message: 'Task deleted successfully',
        });
      } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).send({
          success: false,
          message: 'Failed to delete task',
          error: error.message,
        });
      }
    });



    app.put('/tasks/:id', async (req, res) => {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: 'Invalid ID' });
      }

      const {
        title,
        description,
        userEmail,
        category,
        orderid,
        columnId,
        timestamp,
      } = req.body;

      if (
        !title ||
        !category ||
        !userEmail ||
        !orderid ||
        !columnId ||
        !timestamp
      ) {
        return res
          .status(400)
          .json({ success: false, message: 'Missing required fields' });
      }

      try {
        const result = await tasksCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              title,
              description,
              category,
              orderid,
              columnId,
              id,
              userEmail,
              timestamp,
            },
          }
        );

        const updatedTask = await tasksCollection.findOne({
          _id: new ObjectId(id),
        });

        res.status(200).json({
          success: true,
          message: 'Task updated successfully',
          data: updatedTask,
        });
      } catch (err) {
        console.error('Update Error:', err);
        res
          .status(500)
          .json({ success: false, message: 'Failed to update task' });
      }
    });




    app.get('/tasks/:id', async (req, res) => {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: 'Invalid ID' });
      }

      try {
        const task = await tasksCollection.findOne({ _id: new ObjectId(id) });

        if (!task) {
          return res
            .status(404)
            .json({ success: false, message: 'Task not found' });
        }
        res.status(200).json({
          success: true,
          message: 'Task fetched successfully',
          data: task,
        });
      } catch (err) {
        console.error('Fetch Error:', err);
        res
          .status(500)
          .json({ success: false, message: 'Failed to fetch task' });
      }
    });
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('DB is sitting! Server is running successfully.');
  });

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
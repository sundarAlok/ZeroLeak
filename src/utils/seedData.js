import { db } from '../firebase/firebase';
import { doc, setDoc, collection, addDoc } from 'firebase/firestore';

// Function to seed initial data
export const seedData = async () => {
  // Seed users
  const users = [
    {
      id: 'user1',
      name: 'John Doe',
      username: 'johndoe',
      bio: 'I am using ZeroLeak',
      dob: '1990-01-01',
      phone: '+91-9876543210',
      email: 'john@example.com',
      createdAt: new Date().toISOString() // Adjust for +5:30 GMT Delhi if needed
    },
    {
      id: 'user2',
      name: 'Jane Smith',
      username: 'janesmith',
      bio: 'Loving ZeroLeak!',
      dob: '1985-05-15',
      phone: '+91-9876543211',
      email: 'jane@example.com',
      createdAt: new Date().toISOString()
    }
  ];

  for (const user of users) {
    await setDoc(doc(db, 'users', user.id), user);
  }

  // Seed messages
  const messages = [
    {
      text: 'Hello everyone!',
      userId: 'user1',
      userName: 'John Doe',
      timestamp: new Date().toISOString()
    },
    {
      text: 'Welcome to ZeroLeak',
      userId: 'user2',
      userName: 'Jane Smith',
      timestamp: new Date().toISOString()
    }
  ];

  for (const message of messages) {
    await addDoc(collection(db, 'messages'), message);
  }

  console.log('Seed data added successfully');
};

const memory = new Map();

const storage = {
  async getItem(key) {
    return memory.has(key) ? memory.get(key) : null;
  },
  async setItem(key, value) {
    memory.set(key, value);
  },
  async removeItem(key) {
    memory.delete(key);
  },
};

export default storage;
